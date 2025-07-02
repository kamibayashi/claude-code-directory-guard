# Claude Code Directory Guard

A security hook for [Claude Code](https://claude.ai/code) that prevents file
operations outside the current working directory.

## Overview

This Deno-based script acts as a PreToolUse hook in Claude Code, blocking any
attempts to:

- Write files outside the working directory
- Execute commands that access files outside the working directory
- Navigate to directories outside the project scope

## Installation

1. Clone or copy the `guard.ts` file to your Claude Code hooks directory:

   ```bash
   git clone https://github.com/kamibayashi/claude-code-directory-guard.git
   ```

2. Make the script executable:

   ```bash
   chmod +x path/to/claude-code-directory-guard/guard.ts
   ```

3. In each project where you use Claude Code, create a `settings.json` file in the project root with both the hook configuration and the CLAUDE_WORKING_DIR environment variable:
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash|Write|MultiEdit|Edit",
           "hooks": [
             {
               "type": "command",
               "command": "deno run --allow-read --allow-env ~/.claude/bin/claude-code-directory-guard/guard.ts"
             }
           ]
         }
       ]
     },
     "env": {
       "CLAUDE_WORKING_DIR": "/path/to/your/project"
     }
   }
   ```

## How It Works

The guard:

1. Extracts the working directory from CLAUDE_WORKING_DIR environment variable
   (required)
2. Intercepts Write, Edit, MultiEdit, and Bash commands
3. Analyzes file paths in the commands
4. Blocks operations that would access files outside the working directory
5. Uses exit code 2 to prevent tool execution when a violation is detected

## Testing

Run the test suite:

```bash
deno test guard_test.ts
```

## Requirements

- [Deno](https://deno.land/) runtime
- Claude Code v0.13.0 or later

## Security Notes

- The script fails open (allows operations) if it encounters errors to prevent
  breaking Claude Code
- If CLAUDE_WORKING_DIR is not set, the guard will allow all operations
- Read operations are not blocked as they don't modify the filesystem
- Path normalization handles `..`, `.`, and other path traversal attempts

## License

MIT License - See LICENSE file for details
