import React, { useRef, useEffect } from 'react';

interface DarkVeilProps {
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  speed?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  resolutionScale?: number;
}

export const DarkVeil: React.FC<DarkVeilProps> = ({
  hueShift = 0,
  noiseIntensity = 0.5,
  scanlineIntensity = 0,
  speed = 1.0,
  scanlineFrequency = 1.0,
  warpAmount = 1.0,
  resolutionScale = 1.0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    let animationFrameId: number;
    let startTime = Date.now();

    // Vertex Shader
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment Shader
    // A flowing, dark atmospheric shader
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_hue_shift;
      uniform float u_noise_str;
      uniform float u_warp;
      uniform float u_scanline_str;
      uniform float u_scanline_freq;

      // Simple hash function
      float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
      }

      // Noise function
      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i + vec2(0.0, 0.0));
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // FBM for flow
      float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
          }
          return v;
      }

      vec3 hsb2rgb(vec3 c) {
          vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          rgb = rgb * rgb * (3.0 - 2.0 * rgb);
          return c.z * mix(vec3(1.0), rgb, c.y);
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy;
          
          // Subtle movement
          float t = u_time * 0.2;
          
          // Create warp field
          vec2 warp = vec2(
              fbm(uv * 3.0 + t),
              fbm(uv * 3.0 - t)
          ) * u_warp;

          // Main flow pattern
          vec2 p = uv * 2.0 - 1.0;
          p += warp;
          
          // Base gradients
          float n = fbm(p * 2.0 + vec2(t * 0.5, t * 0.2));
          
          // Dark Veil Colors (Deep Indigo/Black base)
          // We use u_hue_shift to gently rotate the accent color
          
          float hue = 0.7 + (u_hue_shift * 0.01) + (n * 0.1); 
          vec3 color = hsb2rgb(vec3(hue, 0.8, 0.2 + n * 0.3));
          
          // Darken edges (Vignette)
          float vignette = 1.0 - smoothstep(0.5, 1.5, length(uv - 0.5) * 2.0);
          color *= vignette;
          
          // Add noise grain
          float grain = (hash(uv * u_time) - 0.5) * u_noise_str;
          color += grain;
          
          // Scanlines
          float scanline = sin(uv.y * u_resolution.y * u_scanline_freq * 0.1 + u_time * 5.0) * 0.5 + 0.5;
          color *= 1.0 - (scanline * u_scanline_str);

          gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Shader Compilation Helper
    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Geometry (Full quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniform Locations
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const hueShiftLocation = gl.getUniformLocation(program, "u_hue_shift");
    const noiseStrLocation = gl.getUniformLocation(program, "u_noise_str");
    const warpLocation = gl.getUniformLocation(program, "u_warp");
    const scanlineStrLocation = gl.getUniformLocation(program, "u_scanline_str");
    const scanlineFreqLocation = gl.getUniformLocation(program, "u_scanline_freq");

    // Render Loop
    const render = () => {
      // Resize
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
         canvas.width = canvas.clientWidth * resolutionScale;
         canvas.height = canvas.clientHeight * resolutionScale;
         gl.viewport(0, 0, canvas.width, canvas.height);
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      
      gl.uniform1f(timeLocation, elapsedSeconds * speed);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(hueShiftLocation, hueShift);
      gl.uniform1f(noiseStrLocation, noiseIntensity);
      gl.uniform1f(warpLocation, warpAmount);
      gl.uniform1f(scanlineStrLocation, scanlineIntensity);
      gl.uniform1f(scanlineFreqLocation, scanlineFrequency);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
    };
  }, [hueShift, noiseIntensity, scanlineIntensity, speed, scanlineFrequency, warpAmount, resolutionScale]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />;
};
