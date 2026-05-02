"use strict";

class NodeProgressReporter {
  onTestEnd(test, result) {
    const project = test.parent?.project()?.name || "";
    const parts = test.titlePath().filter((part) => part && part !== project);
    const name = [project, ...parts].filter(Boolean).join(" › ");
    const errors = result.errors || [];
    process.stdout.write(`${JSON.stringify({
      type: "testEnd",
      name,
      ok: result.status === test.expectedStatus,
      skipped: result.status === "skipped",
      duration: result.duration,
      message: errors.map((error) => error.message || error.stack || String(error)).join("\n\n")
    })}\n`);
  }

  onError(error) {
    process.stderr.write(`${error.message || error}\n`);
  }
}

module.exports = NodeProgressReporter;
