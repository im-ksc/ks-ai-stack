export type Todo = { content: string; status: string; activeForm?: string }
export type Branch = { name: string; isDirty: boolean }
export type Limit = { percentUsed: number; resetsAt?: string }
export type Budget = { contextPercent?: number; contextTokens?: number; contextLimit?: number; costUsd?: number; fiveHour?: Limit; weekly?: Limit }

declare module 'claude-code' {
  interface PluginState {
    hud: {
      todos: Todo[]
      tasks: Record<string, Todo>
      branch: Branch | null
      budget: Budget
      tokens: { input: number; output: number }
      isHidden: boolean
    }
  }
}
