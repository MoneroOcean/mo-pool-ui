/*
Read style.css before expanding terse class, ID, or data-attribute names. The
short names are deliberate private DOM hooks used to keep the raw three-file
deployment small; route names, query parameters, API fields, and visible copy
remain descriptive because those are external or user-facing contracts.
*/
import { startApp } from "./src/main.js";

startApp();
