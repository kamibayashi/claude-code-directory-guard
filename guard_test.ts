import { assertEquals } from "https://deno.land/std@0.210.0/testing/asserts.ts";
import { DirectoryGuard, type HookInput } from "./guard.ts";

// Helper to create guard with specific working directory
function createGuardWithWorkingDir(
  workingDir: string,
): DirectoryGuard {
  return new DirectoryGuard(workingDir);
}

Deno.test("DirectoryGuard - Constructor accepts working directory", () => {
  const guard = new DirectoryGuard("/Users/test/my-awesome-project");
  // @ts-ignore - accessing private for testing
  assertEquals(guard.workingDir, "/Users/test/my-awesome-project");
});

Deno.test("DirectoryGuard - Write tool within directory", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "/Users/user/work/project/test.py",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, true);
});

Deno.test("DirectoryGuard - Write tool outside directory", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "/Users/user/work/other/test.py",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
  assertEquals(result.reason?.includes("outside working directory"), true);
});

Deno.test("DirectoryGuard - Write tool with relative path going up", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "../test.py",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Write tool with any file extension", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "../randomfile.xyz",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Write tool with safe relative path", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "./subdir/test.py",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, true);
});

Deno.test("DirectoryGuard - Bash command with safe paths", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "ls -la ./src",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, true);
});

Deno.test("DirectoryGuard - Bash command with unsafe paths", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "cat ../../../etc/passwd",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Bash cd command outside directory", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "cd /etc",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - MultiEdit with multiple paths", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "MultiEdit",
    tool_input: {
      file_path: "/Users/user/work/project/main.py",
      edits: [
        { file_path: "/Users/user/work/project/test.py" },
        { file_path: "../other/hack.py" },
      ],
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
  assertEquals(result.reason?.includes("hack.py"), true);
});

Deno.test("DirectoryGuard - Allow other tools", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Read",
    tool_input: {
      file_path: "/etc/passwd",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, true); // Read is not blocked
});

Deno.test("DirectoryGuard - Complex bash command with mixed paths", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "cp ./src/file.py /tmp/backup.py && echo 'done'",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
  assertEquals(result.reason?.includes("/tmp/backup.py"), true);
});

Deno.test("DirectoryGuard - Path normalization", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "/Users/user/work/project/subdir/../test.py",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, true); // This resolves to /Users/user/work/project/test.py
});

Deno.test("DirectoryGuard - Sneaky path with multiple ..", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "./subdir/../../test.py",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Bash echo to file outside", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "echo 'test' > ../outside.txt",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Bash with quoted paths", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: 'cp "file with spaces.txt" "../parent dir/file.txt"',
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
  assertEquals(result.reason?.includes("../parent dir/file.txt"), true);
});

Deno.test("DirectoryGuard - Write with no extension", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      file_path: "../SECRET",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Bash with symlink attempt", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "ln -s /etc/passwd ./passwd_link",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
  assertEquals(result.reason?.includes("/etc/passwd"), true);
});

Deno.test("DirectoryGuard - Bash with pipe to outside file", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "ls | tee /tmp/output.txt",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Edit tool with outside path", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Edit",
    tool_input: {
      file_path: "/etc/hosts",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
  assertEquals(result.reason?.includes("Edit path"), true);
});

Deno.test("DirectoryGuard - Bash with append redirection", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "echo 'data' >> /var/log/test.log",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});

Deno.test("DirectoryGuard - Write with null file_path", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Write",
    tool_input: {
      // @ts-ignore - testing edge case
      file_path: null,
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, true); // Should allow when path is null/undefined
});

Deno.test("DirectoryGuard - Bash with tilde path outside working dir", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "touch ~/.ssh/known_hosts",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false); // ~/.ssh is outside /Users/user/work/project
});

Deno.test("DirectoryGuard - Bash with tilde path when working in home", () => {
  // Save original HOME
  const originalHome = Deno.env.get("HOME");

  // Set HOME to match test scenario
  Deno.env.set("HOME", "/Users/user");

  try {
    const guard = createGuardWithWorkingDir(
      "/Users/user",
    );

    const input: HookInput = {
      tool_name: "Bash",
      tool_input: {
        command: "touch ~/.config/settings.json",
      },
      transcript_path: "/Users/user/.claude/projects/-Users-user/session.jsonl",
    };

    const result = guard.check(input);
    assertEquals(result.allowed, true); // ~/.config is inside /Users/user
  } finally {
    // Restore original HOME
    if (originalHome) {
      Deno.env.set("HOME", originalHome);
    }
  }
});

Deno.test("DirectoryGuard - Multiple paths in single command", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command:
        "cp ./file1.txt ./file2.txt && mv ./file2.txt ./backup/file2.txt",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, true); // All paths are within directory
});

Deno.test("DirectoryGuard - Path with trailing slash", () => {
  const guard = createGuardWithWorkingDir(
    "/Users/user/work/project",
  );

  const input: HookInput = {
    tool_name: "Bash",
    tool_input: {
      command: "cd ../",
    },
    transcript_path:
      "/Users/user/.claude/projects/-Users-user-work-project/session.jsonl",
  };

  const result = guard.check(input);
  assertEquals(result.allowed, false);
});
