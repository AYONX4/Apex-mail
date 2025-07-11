"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ElasticHueSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

const ElasticHueSlider: React.FC<ElasticHueSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 360,
  step = 1,
  label = "Adjust Hue",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const progress = (value - min) / (max - min);
  const thumbPosition = progress * 100; // Percentage

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  // We use the native input for actual dragging and value updates
  // and overlay custom elements for styling and animation.

  return (
    <div
      className="relative flex w-full max-w-xs scale-50 flex-col items-center"
      ref={sliderRef}
    >
      {label && (
        <label
          htmlFor="hue-slider-native"
          className="mb-1 text-sm text-gray-300"
        >
          {label}
        </label>
      )}
      <div className="relative flex h-5 w-full items-center">
        {" "}
        {/* Wrapper for track and thumb */}
        {/* Native input: Handles interaction, but visually hidden */}
        <input
          id="hue-slider-native"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          // Style to make it cover the custom track but be transparent
          className="absolute inset-0 z-20 h-full w-full cursor-pointer appearance-none bg-transparent"
          style={{ WebkitAppearance: "none" /* For Safari */ }}
        />
        {/* Custom Track */}
        <div className="absolute left-0 z-0 h-1 w-full rounded-full bg-gray-700"></div>
        {/* Custom Fill (Optional but nice visual) */}
        <div
          className="absolute left-0 z-10 h-1 rounded-full bg-blue-500"
          style={{ width: `${thumbPosition}%` }}
        ></div>
        {/* Custom Thumb (Animated) */}
        {/* Position the thumb wrapper based on progress, then center the thumb inside */}
        <motion.div
          className="absolute top-1/2 z-30 -translate-y-1/2 transform"
          style={{ left: `${thumbPosition}%` }}
          // Animate scale based on dragging state
          animate={{ scale: isDragging ? 1.2 : 1 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: isDragging ? 20 : 30,
          }} // Springy animation
        ></motion.div>
      </div>

      {/* Optional: Display current value below */}
      <AnimatePresence mode="wait">
        <motion.div
          key={value} // Key changes when value changes, triggering exit/enter
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.2 }}
          className="mt-2 text-xs text-gray-500" // Increased margin top for spacing
        >
          {value}°
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

interface FeatureItemProps {
  name: string;
  value: string;
  position: string;
}

interface LightningProps {
  hue?: number;
  xOffset?: number;
  speed?: number;
  intensity?: number;
  size?: number;
}

const Lightning: React.FC<LightningProps> = ({
  hue = 230,
  xOffset = 0,
  speed = 1,
  intensity = 1,
  size = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uHue;
      uniform float uXOffset;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uSize;
      
      #define OCTAVE_COUNT 10

      // Convert HSV to RGB.
      vec3 hsv2rgb(vec3 c) {
          vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float hash11(float p) {
          p = fract(p * .1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
      }

      float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * .1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      mat2 rotate2d(float theta) {
          float c = cos(theta);
          float s = sin(theta);
          return mat2(c, -s, s, c);
      }

      float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 fp = fract(p);
          float a = hash12(ip);
          float b = hash12(ip + vec2(1.0, 0.0));
          float c = hash12(ip + vec2(0.0, 1.0));
          float d = hash12(ip + vec2(1.0, 1.0));
          
          vec2 t = smoothstep(0.0, 1.0, fp);
          return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
      }

      float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < OCTAVE_COUNT; ++i) {
              value += amplitude * noise(p);
              p *= rotate2d(0.45);
              p *= 2.0;
              amplitude *= 0.5;
          }
          return value;
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
          // Normalized pixel coordinates.
          vec2 uv = fragCoord / iResolution.xy;
          uv = 2.0 * uv - 1.0;
          uv.x *= iResolution.x / iResolution.y;
          // Apply horizontal offset.
          uv.x += uXOffset;
          
          // Adjust uv based on size and animate with speed.
          uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;
          
          float dist = abs(uv.x);
          // Compute base color using hue.
          vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
          // Compute color with intensity and speed affecting time.
          vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
          col = pow(col, vec3(1.0));
          fragColor = vec4(col, 1.0);
      }

      void main() {
          mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    const compileShader = (
      source: string,
      type: number,
    ): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(
      fragmentShaderSource,
      gl.FRAGMENT_SHADER,
    );
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const uHueLocation = gl.getUniformLocation(program, "uHue");
    const uXOffsetLocation = gl.getUniformLocation(program, "uXOffset");
    const uSpeedLocation = gl.getUniformLocation(program, "uSpeed");
    const uIntensityLocation = gl.getUniformLocation(program, "uIntensity");
    const uSizeLocation = gl.getUniformLocation(program, "uSize");

    const startTime = performance.now();
    const render = () => {
      resizeCanvas();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      const currentTime = performance.now();
      gl.uniform1f(iTimeLocation, (currentTime - startTime) / 1000.0);
      gl.uniform1f(uHueLocation, hue);
      gl.uniform1f(uXOffsetLocation, xOffset);
      gl.uniform1f(uSpeedLocation, speed);
      gl.uniform1f(uIntensityLocation, intensity);
      gl.uniform1f(uSizeLocation, size);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [hue, xOffset, speed, intensity, size]);

  return <canvas ref={canvasRef} className="relative h-full w-full" />;
};

const FeatureItem: React.FC<FeatureItemProps> = ({ name, value, position }) => {
  return (
    <div
      className={`absolute ${position} group z-10 transition-all duration-300 hover:scale-110`}
    >
      <div className="relative flex items-center gap-2">
        {/* Dot with constant glow */}
        <div className="relative">
          <div className="h-2 w-2 rounded-full bg-white group-hover:animate-pulse"></div>
          <div className="absolute -inset-1 rounded-full bg-white/20 opacity-70 blur-sm transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>
        <div className="relative text-white">
          <div className="font-medium transition-colors duration-300 group-hover:text-white">
            {name}
          </div>
          <div className="text-sm text-white/70 transition-colors duration-300 group-hover:text-white/70">
            {value}
          </div>
          {/* Constant white glow that intensifies on hover */}
          <div className="absolute -inset-2 -z-10 rounded-lg bg-white/10 opacity-70 blur-md transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>
      </div>
    </div>
  );
};

export const HeroSection: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // State for the lightning hue
  const [lightningHue, setLightningHue] = useState(260);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: any = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <div className="relative w-full overflow-hidden bg-black text-white">
      {/* Main container with space for content */}
      <div className="relative z-20 mx-auto h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Navigation */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="rounded-50 mb-12 flex items-center justify-between bg-black/50 px-4 py-4 backdrop-blur-3xl"
        >
          <div className="flex items-center">
            <div className="text-2xl font-bold">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path
                  d="M20 5L5 20L20 35L35 20L20 5Z"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className="ml-8 hidden items-center space-x-6 md:flex">
              <button className="rounded-full bg-gray-800/50 px-4 py-2 text-sm transition-colors hover:bg-gray-700/50">
                Start
              </button>
              <button className="px-4 py-2 text-sm transition-colors hover:text-gray-300">
                Home
              </button>
              <button className="px-4 py-2 text-sm transition-colors hover:text-gray-300">
                Contacts
              </button>
              <button className="px-4 py-2 text-sm transition-colors hover:text-gray-300">
                Help
              </button>
              <button className="px-4 py-2 text-sm transition-colors hover:text-gray-300">
                Docs
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="hidden px-4 py-2 text-sm transition-colors hover:text-gray-300 md:block">
              Register
            </button>
            <button className="rounded-full bg-gray-800/80 px-4 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-gray-700/80">
              Application
            </button>
            {/* Mobile menu button */}
            <button
              className="rounded-md p-2 focus:outline-none md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </motion.div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 z-9999 bg-black/95 backdrop-blur-lg md:hidden"
          >
            <div className="flex h-full flex-col items-center justify-center space-y-6 text-lg">
              <button
                className="absolute top-6 right-6 p-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <button className="rounded-full bg-gray-800/50 px-6 py-3">
                Start
              </button>
              <button className="px-6 py-3">Home</button>
              <button className="px-6 py-3">Contacts</button>
              <button className="px-6 py-3">Help</button>
              <button className="px-6 py-3">Docs</button>
              <button className="px-6 py-3">Register</button>
              <button className="rounded-full bg-gray-800/80 px-6 py-3 backdrop-blur-sm">
                Application
              </button>
            </div>
          </motion.div>
        )}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative top-[30%] z-200 w-full"
        >
          <motion.div variants={itemVariants}>
            <FeatureItem
              name="React"
              value="for base"
              position="left-0 sm:left-10 top-40"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <FeatureItem
              name="Tailwind"
              value="for styles"
              position="left-1/4 top-24"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <FeatureItem
              name="Framer-motion"
              value="for animations"
              position="right-1/4 top-24"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <FeatureItem
              name="Shaders"
              value="for lightning"
              position="right-0 sm:right-10 top-40"
            />
          </motion.div>
        </motion.div>

        {/* Main hero content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-30 mx-auto flex max-w-4xl flex-col items-center text-center"
        >
          {/* Button: "Join us for free world" */}
          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group mb-6 flex items-center space-x-2 rounded-full bg-white/5 px-4 py-2 text-sm backdrop-blur-sm transition-all duration-300 hover:bg-white/10" // Reduced mb slightly
          >
            <span>Join us for free world</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transform transition-transform duration-300 group-hover:translate-x-1"
            >
              <path
                d="M8 3L13 8L8 13M13 8H3"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>

          <motion.h1
            variants={itemVariants}
            className="mb-2 text-5xl font-light md:text-7xl"
          >
            The minimalistic,
          </motion.h1>

          <motion.h2
            variants={itemVariants}
            className="bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300 bg-clip-text pb-3 text-3xl font-light text-transparent md:text-5xl"
          >
            AI-powered email client.
          </motion.h2>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="mb-9 max-w-2xl text-gray-400"
          >
            Normal Human is a minimalistic, AI-powered email client that
            empowers you to manage your email with ease.{" "}
          </motion.p>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="mt-[100px] rounded-full bg-white/10 px-8 py-3 backdrop-blur-sm transition-colors hover:bg-white/20 sm:mt-[100px]"
          >
            Discover Those Worlds
          </motion.button>
        </motion.div>
      </div>

      {/* Background elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 z-0"
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/80"></div>

        {/* Glowing circle */}
        <div className="absolute top-[55%] left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-gradient-to-b from-blue-500/20 to-purple-600/10 blur-3xl"></div>

        {/* Central light beam - now using the state variable for hue */}
        <div className="absolute top-0 left-1/2 h-full w-[100%] -translate-x-1/2 transform">
          <Lightning
            hue={lightningHue} // Use the state variable here
            xOffset={0}
            speed={1.6}
            intensity={0.6}
            size={2}
          />
        </div>

        {/* Planet/sphere */}
      </motion.div>
    </div>
  );
};
