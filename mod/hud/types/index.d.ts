export type Todo = { content: string; status: string; activeForm?: string }
export type Branch = { name: string; isDirty: boolean }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type ContextGroup = { name: string; tokens: number; color: string }
export type Budget = { contextPercent?: number; contextTokens?: number; contextLimit?: number; isToCompact?: boolean; contextGroups?: ContextGroup[]; costUsd?: number; fiveHour?: Limit; weekly?: Limit }

declare module 'claude-code' {
  interface PluginState {
    hud: {
      todos: Todo[]
      tasks: Record<string, Todo>
      branch: Branch | null
      budget: Budget
      tokens: { input: number; output: number }
      isHidden: boolean
      isCollapsed: boolean
      minute: number
    }
  }
}
