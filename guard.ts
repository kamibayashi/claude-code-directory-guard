#!/usr/bin/env -S deno run --allow-read --allow-env

interface HookInput {
  tool_name: string;
  tool_input: {
    command?: string;
    file_path?: string;
    edits?: Array<{ file_path?: string }>;
  };
  transcript_path?: string; // Not used, kept for compatibility
}

class DirectoryGuard {
  private workingDir: string;

  constructor(workingDir: string) {
    this.workingDir = workingDir;
  }

  private expandTilde(path: string): string {
    if (path.startsWith("~")) {
      try {
        const homeDir = Deno.env.get("HOME") || "/home/user";
        return path.replace(/^~/, homeDir);
      } catch {
        // If we can't access HOME env var, return original path
        return path;
      }
    }
    return path;
  }

  private isPathSafe(path: string): boolean {
    if (!path) return true;

    // Expand tilde if present
    const expandedPath = this.expandTilde(path);

    // Resolve to absolute path
    let absolutePath: string;
    if (expandedPath.startsWith("/")) {
      absolutePath = expandedPath;
    } else {
      absolutePath = `${this.workingDir}/${expandedPath}`;
    }

    // Normalize the path (resolve .., ., etc)
    const normalizedPath = this.normalizePath(absolutePath);
    const normalizedWorkingDir = this.normalizePath(this.workingDir);

    // Check if path is within working directory
    return (
      normalizedPath === normalizedWorkingDir ||
      normalizedPath.startsWith(normalizedWorkingDir + "/")
    );
  }

  private normalizePath(path: string): string {
    const parts = path.split("/").filter((part) => part !== "");
    const stack: string[] = [];

    for (const part of parts) {
      if (part === ".") {
        continue;
      } else if (part === "..") {
        stack.pop();
      } else {
        stack.push(part);
      }
    }

    return "/" + stack.join("/");
  }

  private extractPathsFromCommand(command: string): string[] {
    const paths: string[] = [];

    // Split command into tokens, handling quotes
    const tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].replace(/^["']|["']$/g, ""); // Remove quotes

      // Skip flags and command names
      if (token.startsWith("-") || i === 0) {
        continue;
      }

      // Check if token looks like a path
      if (
        token.includes("/") || // Contains slash
        token.startsWith(".") || // Hidden files or relative paths
        token.includes("..") || // Parent directory reference
        token.startsWith("~") || // Home directory reference
        (i > 0 && [">", ">>", "<"].includes(tokens[i - 1])) // Redirection target
      ) {
        paths.push(token);
      }

      // Handle redirection without spaces (e.g., >file.txt)
      if (token.match(/^[>]+(.+)$/)) {
        const match = token.match(/^[>]+(.+)$/);
        if (match) paths.push(match[1]);
      }
    }

    // Special handling for cd command
    if (command.startsWith("cd ")) {
      const cdPath = command
        .substring(3)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (cdPath && cdPath !== "-") {
        paths.push(cdPath);
      }
    }

    return [...new Set(paths)]; // Remove duplicates
  }

  private checkPath(path: string | undefined, toolName: string): { allowed: boolean; reason?: string } | null {
    if (!path) return null;
    
    if (!this.isPathSafe(path)) {
      return {
        allowed: false,
        reason: `${toolName} path '${path}' is outside working directory '${this.workingDir}'`,
      };
    }
    return null;
  }

  public check(input: HookInput): { allowed: boolean; reason?: string } {
    const { tool_name, tool_input } = input;

    // Only check specific tools
    if (!["Bash", "Write", "MultiEdit", "Edit"].includes(tool_name)) {
      return { allowed: true };
    }

    try {
      // Check file_path for Write, Edit, and MultiEdit tools
      if (["Write", "Edit", "MultiEdit"].includes(tool_name)) {
        const result = this.checkPath(tool_input.file_path, tool_name);
        if (result) return result;
      }

      // Check MultiEdit edits array
      if (tool_name === "MultiEdit" && tool_input.edits) {
        for (const edit of tool_input.edits) {
          const result = this.checkPath(edit.file_path, "MultiEdit");
          if (result) return result;
        }
      }

      // Check Bash commands
      if (tool_name === "Bash" && tool_input.command) {
        const paths = this.extractPathsFromCommand(tool_input.command);
        for (const path of paths) {
          if (!this.isPathSafe(path)) {
            return {
              allowed: false,
              reason: `Command contains path '${path}' outside working directory '${this.workingDir}'`,
            };
          }
        }
      }

      return { allowed: true };
    } catch (error) {
      // Log error but allow command to proceed (fail open for safety)
      console.error(`Error in directory guard: ${error}`);
      return { allowed: true };
    }
  }
}

// Main execution
// @ts-ignore - Deno specific
if (import.meta.main) {
  try {
    // Get working directory from environment
    const workingDir = Deno.env.get("CLAUDE_WORKING_DIR");
    if (!workingDir) {
      console.error(
        "Error: CLAUDE_WORKING_DIR environment variable not available",
      );
      Deno.exit(0); // Fail open if we can't determine working directory
    }

    // Read input from stdin
    const decoder = new TextDecoder();
    const data = await Deno.stdin.readable.getReader().read();
    const input = JSON.parse(decoder.decode(data.value)) as HookInput;

    const guard = new DirectoryGuard(workingDir);
    const result = guard.check(input);

    if (!result.allowed) {
      console.error(`❌ BLOCKED: ${result.reason}`);
      Deno.exit(2); // Exit code 2 blocks the tool execution
    }

    Deno.exit(0);
  } catch (error) {
    console.error(`Error: ${error}`);
    Deno.exit(0); // Fail open
  }
}

export { DirectoryGuard, type HookInput };
