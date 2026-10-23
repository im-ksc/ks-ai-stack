import os
from pathlib import Path
import pty
import stat
import subprocess
import tempfile
import unittest


TEMPLATE = Path(os.environ.get('WIZARD_TEMPLATE', Path(__file__).with_name('template.sh'))).resolve()
LIBRARY = TEMPLATE.read_text().split('# STAGES:', 1)[0]


class WizardHelpers(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.library = self.root / 'library.sh'
        self.library.write_text(LIBRARY)

    def run_bash(self, body, *, stdin='', extra_env=None, expected_return=0):
        result = subprocess.run(
            ['/bin/bash', '-c', 'source "$WIZARD_LIBRARY"\n' + body],
            input=stdin, text=True, capture_output=True, cwd=self.root,
            env={**os.environ, 'TMPDIR': str(self.root),
                 'WIZARD_LIBRARY': str(self.library), **(extra_env or {})},
        )
        self.assertEqual(result.returncode, expected_return, result.stdout + result.stderr)
        return result

    def test_written_value_survives_rerun(self):
        value = "dummy # value ' with $dollar `backticks` \\ and = equals"
        self.run_bash('write_env API_VALUE "$DUMMY_VALUE"\n'
                      '[[ "$(_existing API_VALUE)" == "$DUMMY_VALUE" ]]\n'
                      'source "$ENV_FILE"\n[[ "$API_VALUE" == "$DUMMY_VALUE" ]]',
                      extra_env={'DUMMY_VALUE': value})

    def test_upsert_keeps_other_values_and_replaces_duplicate_key(self):
        (self.root / '.env').write_text("KEEP='original'\nAPI_VALUE=old\nAPI_VALUE=older\n")
        self.run_bash('write_env API_VALUE updated\nwrite_env API_VALUE final')
        self.assertEqual((self.root / '.env').read_text(), "KEEP='original'\nAPI_VALUE='final'\n")

    def test_new_env_is_private(self):
        self.run_bash('umask 022\nwrite_env API_VALUE dummy')
        self.assertEqual(stat.S_IMODE((self.root / '.env').stat().st_mode), 0o600)

    def test_existing_mode_and_symlink_target_survive(self):
        target = self.root / 'actual.env'
        target.write_text('KEEP=original\n')
        target.chmod(0o640)
        (self.root / '.env').symlink_to(target)
        self.run_bash('write_env API_VALUE dummy')
        self.assertTrue((self.root / '.env').is_symlink())
        self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o640)
        self.assertEqual(target.read_text(), "KEEP=original\nAPI_VALUE='dummy'\n")

    def test_visible_input_enter_keeps_decoded_saved_value(self):
        (self.root / '.env').write_text('API_VALUE="saved value"\n')
        self.run_bash('ask API_VALUE "Value:"\n[[ "$API_VALUE" == "saved value" ]]', stdin='\n')

    def test_hidden_input_enter_keeps_saved_value(self):
        (self.root / '.env').write_text("API_VALUE='dummy saved value'\n")
        self.run_bash('ask_secret API_VALUE "Value:"\n[[ "$API_VALUE" == "dummy saved value" ]]', stdin='\n')

    def test_eof_without_input_stops_both_prompts(self):
        for saved in [False, True]:
            if saved:
                (self.root / '.env').write_text("API_VALUE='dummy'\n")
            for prompt in ['ask', 'ask_secret']:
                with self.subTest(saved=saved, prompt=prompt):
                    self.run_bash(f'{prompt} API_VALUE "Value:"', expected_return=1)

    def test_partial_input_at_eof_is_accepted(self):
        for prompt in ['ask', 'ask_secret']:
            with self.subTest(prompt=prompt):
                self.run_bash(f'{prompt} API_VALUE "Value:"\n[[ "$API_VALUE" == "dummy partial" ]]',
                              stdin='dummy partial')

    def test_ambiguous_saved_escapes_require_fresh_input(self):
        (self.root / '.env').write_text('API_VALUE="literal $PLACEHOLDER"\n')
        self.run_bash('ask API_VALUE "Value:"\n[[ "$API_VALUE" == "replacement" ]]', stdin='replacement\n')

    def test_non_terminal_clear_leaves_logs_readable(self):
        self.assertEqual(self.run_bash('_clear').stdout, '')

    def test_missing_browser_opener_warns(self):
        result = self.run_bash('command() { return 1; }\nopen_url https://example.invalid/dummy')
        self.assertIn("couldn't open a browser", result.stdout)

    def test_failing_browser_opener_warns(self):
        result = self.run_bash('wslview() { return 1; }\nopen_url https://example.invalid/dummy')
        self.assertIn("couldn't open a browser", result.stdout)

    def test_terminal_clear_falls_back_when_tput_fails(self):
        master, slave = pty.openpty()
        try:
            process = subprocess.Popen(
                ['/bin/bash', '-c', 'source "$WIZARD_LIBRARY"\ntput() { return 1; }\n_clear'],
                cwd=self.root, env={**os.environ, 'TERM': 'dumb', 'WIZARD_LIBRARY': str(self.library)},
                stdout=slave, stderr=slave,
            )
            os.close(slave)
            slave = None
            output = bytearray()
            while True:
                try:
                    chunk = os.read(master, 4096)
                except OSError:
                    break
                if not chunk:
                    break
                output.extend(chunk)
            self.assertEqual(process.wait(timeout=5), 0, output)
            self.assertIn(b'\x1b[2J\x1b[3J\x1b[H', output)
        finally:
            os.close(master)
            if slave is not None:
                os.close(slave)

    def test_stage_edit_during_prompt_cannot_change_loaded_run(self):
        content = TEMPLATE.read_text()
        begin = content.index('TOTAL_STAGES=1')
        end = content.rindex('\nfinish') + len('\nfinish')
        exercise = "printf 'ready\\n'\nread -r reply\nprintf 'finished-original\\n'\n"
        script = self.root / 'wizard.sh'
        script.write_text(content[:begin] + exercise + content[end:])
        process = subprocess.Popen(['/bin/bash', str(script)], cwd=self.root,
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True)
        try:
            self.assertEqual(process.stdout.readline().strip(), 'ready')
            script.write_text('BROKEN (\n')
            output, error = process.communicate('\n', timeout=5)
            self.assertEqual(process.returncode, 0, error)
            self.assertIn('finished-original', output)
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()


if __name__ == '__main__':
    unittest.main()
