const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "campus-prototype-"));
  await fs.cp(path.resolve("prototipo"), tmp, { recursive: true });
  for (const name of ["fluxos.cjs", "localizacao.cjs"]) {
    const file = path.join(tmp, "verificacao", name);
    await fs.writeFile(
      file,
      (await fs.readFile(file, "utf8")).replaceAll(
        "http://127.0.0.1:5173",
        "http://127.0.0.1:55173",
      ),
    );
  }
  const server = spawn(
    "python3",
    ["-m", "http.server", "55173", "--bind", "127.0.0.1", "--directory", tmp],
    { stdio: "ignore" },
  );
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      setTimeout(resolve, 800);
    });
    for (const file of ["fluxos.cjs", "localizacao.cjs"])
      await new Promise((resolve, reject) => {
        const proc = spawn(
          process.execPath,
          [path.join(tmp, "verificacao", file)],
          {
            stdio: "inherit",
            env: {
              ...process.env,
              CAMPUS_PLAYWRIGHT: require.resolve("@playwright/test"),
              CAMPUS_CHROME:
                process.env.CAMPUS_CHROME || "/opt/google/chrome/chrome",
            },
          },
        );
        proc.on("exit", (code) =>
          code === 0 ? resolve() : reject(new Error(file + " falhou: " + code)),
        );
      });
  } finally {
    server.kill();
    await fs.rm(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
