# Claude Code Directory Guard

## Project Overview

A security hook (directory guard) for Claude Code implemented in
TypeScript/Deno. Blocks file operations outside the working directory.

## Implementation Details

### 1. Main Script (`guard.ts`)

- Location: `/path/to/claude-code-directory-guard/guard.ts`
- Operates as a PreToolUse hook
- Monitors Write, Edit, MultiEdit, and Bash commands
- Blocks tool execution with exit code 2

### 2. Major Fix History

#### a. Double-dash Issue Fix

- Issue: `-Users-kamibayashimasaki--claude` → `/Users/kamibayashimasaki//claude`
  (double slash)
- Cause: `--` (double dash) was representing `.`
- Fix:

```typescript
const decodedPath = "/" +
  pathWithoutLeading.replace(/--/g, "/.").replace(/-/g, "/");
```

#### b. Tilde (~) Path Handling

- Proper expansion of home directory paths
- Added `expandTilde` method to expand `~` to `$HOME`
- Considers cases where working directory is home directory

#### c. CLAUDE_WORKING_DIR-based Implementation

- Issue: Hyphen in directory names cannot be distinguished from path separators
  in transcript_path
- Solution: Use CLAUDE_WORKING_DIR environment variable exclusively
- Implementation:
  - Removed buggy extractWorkingDirectory method entirely
  - DirectoryGuard constructor now accepts working directory as parameter
  - Main function checks CLAUDE_WORKING_DIR environment variable
  - Fails open (allows operation) if CLAUDE_WORKING_DIR not available
  - transcript_path no longer used anywhere
  - All tests updated - now 26 tests (removed environment variable check test)

### 3. Test Suite (`guard_test.ts`)

- 26 comprehensive test cases
- Coverage:
  - Basic in/out directory determination
  - Relative paths, absolute paths
  - Parent directory access via `..`
  - Double-dash path conversion
  - Tilde path expansion
  - Symbolic link creation detection
  - Pipes, redirections
  - Edit/MultiEdit tools
  - Edge cases (null, trailing slashes, etc.)

### 4. Configuration File (`settings.json`)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|MultiEdit|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "deno run /path/to/claude-code-directory-guard/guard.ts"
          }
        ]
      }
    ]
  }
}
```

### 5. Project Structure

```
~/.claude/bin/directory-guard/
├── guard.ts          # Main script
├── guard_test.ts     # Test file
├── README.md         # Documentation
├── LICENSE           # MIT License
├── tsconfig.json     # TypeScript configuration
└── .gitignore        # Git exclusions
```

## Important Technical Details

### Path Extraction Logic (`extractPathsFromCommand`)

- Token splitting considers quotes
- Detects:
  - Paths containing `/`
  - Files starting with `.` (hidden files, relative paths)
  - Paths containing `..`
  - Paths starting with `~` (home directory)
  - Redirection targets (`>`, `>>`, `<`)

### transcript_path Format

- Format: `~/.claude/projects/-Users-username-path-to-project/session.jsonl`
- Encoding:
  - `/` → `-`
  - `.` → `--` (double dash)

## Future Improvements

- Currently comprehensively tested with major issues resolved

## GitHub Publication

- Ready for publication under MIT License
- No security issues
- No personal or sensitive information included
