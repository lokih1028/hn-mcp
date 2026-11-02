/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import fs from "node:fs";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// WebGL for the 3D shots. "angle" draws on the GPU (Direct3D on Windows,
// Metal on macOS); "swangle" draws on the CPU with SwiftShader: the same
// picture, about 15x slower. A Linux machine with no /dev/dri (a cloud
// container without a GPU) gets the CPU by default; HN_GL=angle|swangle
// forces either. A --gl flag on the command line overrides both.
type Gl = Parameters<typeof Config.setChromiumOpenGlRenderer>[0];
const noGpu = process.platform === "linux" && !fs.existsSync("/dev/dri");
Config.setChromiumOpenGlRenderer((process.env.HN_GL as Gl | undefined) ?? (noGpu ? "swangle" : "angle"));
