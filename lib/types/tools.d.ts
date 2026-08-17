/**
 * Agent tools: the remote-development surface. Every tool talks to the same
 * engine the web UI uses, so a host configured in the GUI is immediately
 * operable by any agent, and vice versa. Tools mirror the ZCode remote
 * capability set: run commands (git included), read and write remote files,
 * transfer files — all scoped by a per-host remote workspace when one is set.
 */
import type { SshEngine } from './engine.ts';
/** The host-list tool. */
export declare function sshListTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The command-execution tool (remote development workhorse). */
export declare function sshExecTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The remote file read tool. */
export declare function sshReadFileTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The remote directory listing tool (navigation companion of read/write). */
export declare function sshListDirTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The remote file write tool. */
export declare function sshWriteFileTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The upload tool. */
export declare function sshUploadTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The download tool. */
export declare function sshDownloadTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
