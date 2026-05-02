"use strict";
const { Transform } = require("node:stream");
const { spec } = require("node:test/reporters");

class SpacedSpecReporter extends Transform {
  constructor() {
    super({ writableObjectMode: true });
    this.pendingText = "";
    this.lastPrintedNonEmptyLine = "";
    this.lastOutputWasBlank = false;
    this.pendingBlankLines = 0;
    this.reporter = spec();
    this.reporter.on("data", (chunk) => {
      this.push(this.rewriteText(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)));
    });
    this.reporter.on("error", (error) => this.destroy(error));
  }

  rewriteText(text) {
    this.pendingText += text;
    let output = "";
    let newlineIndex = this.pendingText.indexOf("\n");
    while (newlineIndex !== -1) {
      let line = this.pendingText.slice(0, newlineIndex + 1);
      this.pendingText = this.pendingText.slice(newlineIndex + 1);
      output += this.rewriteLine(line);
      newlineIndex = this.pendingText.indexOf("\n");
    }
    return output;
  }

  rewriteLine(line) {
    if (!line.trim()) {
      this.pendingBlankLines += 1;
      return "";
    }

    let output = "";
    const isSuiteLine = /^\s*▶ /.test(line);
    const followsOpeningSuiteLine = isOpeningSuiteLine(this.lastPrintedNonEmptyLine);

    if (isSuiteLine) {
      if (this.lastPrintedNonEmptyLine && !followsOpeningSuiteLine && !this.lastOutputWasBlank) output += "\n";
    } else if (this.pendingBlankLines && this.lastPrintedNonEmptyLine && !this.lastOutputWasBlank) {
      output += "\n";
    }

    this.pendingBlankLines = 0;
    this.lastOutputWasBlank = output.endsWith("\n\n");
    this.lastPrintedNonEmptyLine = line.trimEnd();
    return `${output}${line}`;
  }

  _transform(event, encoding, callback) {
    if (this.reporter.write(event, encoding)) return callback();
    this.reporter.once("drain", callback);
  }

  _flush(callback) {
    this.reporter.end();
    this.reporter.once("end", () => {
      if (this.pendingText) {
        this.push(this.rewriteLine(this.pendingText));
        this.pendingText = "";
      }
      callback();
    });
  }
}

function isOpeningSuiteLine(line) {
  return /^\s*▶ /.test(line) && !/\(\d+(?:\.\d+)?(?:ms|s)\)$/.test(line);
}

module.exports = SpacedSpecReporter;
