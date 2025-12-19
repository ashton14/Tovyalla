import { useRef, useEffect } from 'react'

const ShaderBackground = ({
  flowSpeed = 0.3,
  colorIntensity = 1.5,
  noiseLayers = 2.0,
  mouseInfluence = 0.2,
}) => {
  const canvasRef = useRef(null)
  const mousePos = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) {
      console.error('WebGL is not supported in this browser.')
      return
    }

    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `

    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;
      uniform float uFlowSpeed;
      uniform float uColorIntensity;
      uniform float uNoiseLayers;
      uniform float uMouseInfluence;

      #define MARCH_STEPS 48

      mat2 rot(float a) {
          float s=sin(a), c=cos(a);
          return mat2(c, -s, s, c);
      }

      // Smooth interpolation
      float smoothHash(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f); // Smoothstep
          
          float a = dot(i, vec2(123.34, 456.21));
          float b = dot(i + vec2(1.0, 0.0), vec2(123.34, 456.21));
          float c = dot(i + vec2(0.0, 1.0), vec2(123.34, 456.21));
          float d = dot(i + vec2(1.0, 1.0), vec2(123.34, 456.21));
          
          a = fract(sin(a) * 43758.5453);
          b = fract(sin(b) * 43758.5453);
          c = fract(sin(c) * 43758.5453);
          d = fract(sin(d) * 43758.5453);
          
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec3 p) {
          float f = 0.0;
          float amp = 0.5;
          float scale = 0.8;
          for (int i = 0; i < 8; i++) {
              if (float(i) >= uNoiseLayers) break;
              f += amp * smoothHash(p.xy * scale);
              p *= 1.8;
              amp *= 0.5;
              scale *= 1.3;
          }
          return f;
      }

      float map(vec3 p) {
          vec3 q = p;
          q.z += iTime * uFlowSpeed;
          vec2 mouse = (iMouse.xy / iResolution.xy - 0.5) * 2.0;
          q.xy += mouse * uMouseInfluence;
          
          // Use larger scale for smoother effect
          float f = fbm(q * 0.8);
          
          // Smoother wave function
          float wave = sin(p.y * 1.5 + iTime * 0.3) * 0.5 + 0.5;
          wave = smoothstep(0.3, 0.7, wave); // Smooth transition
          
          f *= wave;
          return smoothstep(0.2, 0.6, f); // Smooth edges
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
        vec3 ro = vec3(0, -1, 0);
        vec3 rd = normalize(vec3(uv, 1.0));
        vec3 col = vec3(0);
        float t = 0.0;
        
        for (int i=0; i<MARCH_STEPS; i++) {
            vec3 p = ro + rd * t;
            float density = map(p);
            if (density > 0.0) {
                // Smoother color transitions
                vec3 auroraColor = 0.5 + 0.5 * cos(iTime * 0.3 + p.y * 1.5 + vec3(0,2,4));
                // Smoother density accumulation
                col += auroraColor * density * 0.08 * uColorIntensity;
            }
            t += 0.08; // Smaller step for smoother gradients
        }
        
        // Smooth color output
        col = smoothstep(0.0, 1.2, col);
        
        gl_FragColor = vec4(col, 1.0);
      }
    `

    const compileShader = (source, type) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`)
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER)
    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`Program linking error: ${gl.getProgramInfoLog(program)}`)
      return
    }
    gl.useProgram(program)

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const aPosition = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    const iResolutionLocation = gl.getUniformLocation(program, 'iResolution')
    const iTimeLocation = gl.getUniformLocation(program, 'iTime')
    const iMouseLocation = gl.getUniformLocation(program, 'iMouse')
    const uFlowSpeedLocation = gl.getUniformLocation(program, 'uFlowSpeed')
    const uColorIntensityLocation = gl.getUniformLocation(program, 'uColorIntensity')
    const uNoiseLayersLocation = gl.getUniformLocation(program, 'uNoiseLayers')
    const uMouseInfluenceLocation = gl.getUniformLocation(program, 'uMouseInfluence')

    const startTime = performance.now()
    let animationFrameId

    const handleMouseMove = (e) => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mousePos.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      }
    }
    window.addEventListener('mousemove', handleMouseMove)

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
      gl.uniform2f(iResolutionLocation, gl.canvas.width, gl.canvas.height)
    }
    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()

    const renderLoop = () => {
      if (!gl || gl.isContextLost()) return

      const currentTime = performance.now()
      gl.uniform1f(iTimeLocation, (currentTime - startTime) / 1000.0)

      gl.uniform2f(
        iMouseLocation,
        mousePos.current.x * canvas.width,
        (1.0 - mousePos.current.y) * canvas.height
      )
      gl.uniform1f(uFlowSpeedLocation, flowSpeed)
      gl.uniform1f(uColorIntensityLocation, colorIntensity)
      gl.uniform1f(uNoiseLayersLocation, noiseLayers)
      gl.uniform1f(uMouseInfluenceLocation, mouseInfluence)

      gl.drawArrays(gl.TRIANGLES, 0, 6)
      animationFrameId = requestAnimationFrame(renderLoop)
    }
    renderLoop()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      if (gl && !gl.isContextLost()) {
        gl.deleteProgram(program)
        gl.deleteShader(vertexShader)
        gl.deleteShader(fragmentShader)
        gl.deleteBuffer(vertexBuffer)
      }
    }
  }, [flowSpeed, colorIntensity, noiseLayers, mouseInfluence])

  return (
    <div className="bg-black absolute inset-0 -z-10 w-full h-full" aria-hidden>
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20" />
    </div>
  )
}

export default ShaderBackground

