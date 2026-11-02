import { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";

// Reports which GPU the render browser's WebGL actually runs on.
export const GpuProbe: React.FC = () => {
  const [info, setInfo] = useState("");
  const [handle] = useState(() => delayRender("gpu probe"));
  useEffect(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const text = gl
      ? `VENDOR=${gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR)} RENDERER=${gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)}`
      : "NO WEBGL";
    console.log(`GPU_PROBE ${text}`);
    setInfo(text);
    continueRender(handle);
  }, [handle]);
  return <AbsoluteFill style={{ background: "#000", color: "#fff", fontSize: 40, padding: 40 }}>{info}</AbsoluteFill>;
};
