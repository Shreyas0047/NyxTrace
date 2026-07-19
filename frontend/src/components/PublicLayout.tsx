import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cn } from '../design-system';

type Uniforms = {
  [key: string]: {
    value: number[] | number[][] | number;
    type: string;
  };
};

const DotMatrix: React.FC<{
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ('x' | 'y')[];
}> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = '',
  center = ['x', 'y'],
}) => {
  const uniforms = useMemo(() => {
    let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
    if (colors.length === 2) {
      colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
    } else if (colors.length === 3) {
      colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
    }
    return {
      u_colors: { value: colorsArray.map((c) => [c[0] / 255, c[1] / 255, c[2] / 255]), type: 'uniform3fv' },
      u_opacities: { value: opacities, type: 'uniform1fv' },
      u_total_size: { value: totalSize, type: 'uniform1f' },
      u_dot_size: { value: dotSize, type: 'uniform1f' },
      u_reverse: { value: shader.includes('u_reverse_active') ? 1 : 0, type: 'uniform1i' },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas className="absolute inset-0 h-full w-full">
        <ShaderMaterial source={`
          precision mediump float;
          in vec2 fragCoord;
          uniform float u_time;
          uniform float u_opacities[10];
          uniform vec3 u_colors[6];
          uniform float u_total_size;
          uniform float u_dot_size;
          uniform vec2 u_resolution;
          uniform int u_reverse;
          out vec4 fragColor;
          float PHI = 1.61803398874989484820459;
          float random(vec2 xy) { return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x); }
          void main() {
            vec2 st = fragCoord.xy;
            ${center.includes('x') ? 'st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));' : ''}
            ${center.includes('y') ? 'st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));' : ''}
            float opacity = step(0.0, st.x); opacity *= step(0.0, st.y);
            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));
            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));
            vec3 color = u_colors[int(show_offset * 6.0)];
            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);
            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);
            float current_timing_offset;
            if (u_reverse == 1) {
              current_timing_offset = timing_offset_outro;
              opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
              opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
              current_timing_offset = timing_offset_intro;
              opacity *= step(current_timing_offset, u_time * animation_speed_factor);
              opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }
            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
          }`}
          uniforms={uniforms}
        />
      </Canvas>
    </div>
  );
};

const ShaderMaterial = ({ source, uniforms }: { source: string; uniforms: Uniforms }) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    (ref.current.material as any).uniforms.u_time.value = clock.getElapsedTime();
  });

  const preparedUniforms = useMemo(() => {
    const result: any = {};
    for (const uniformName in uniforms) {
      const uniform = uniforms[uniformName];
      switch (uniform.type) {
        case 'uniform1f': result[uniformName] = { value: uniform.value, type: '1f' }; break;
        case 'uniform1i': result[uniformName] = { value: uniform.value, type: '1i' }; break;
        case 'uniform3f': result[uniformName] = { value: new THREE.Vector3().fromArray(uniform.value as number[]), type: '3f' }; break;
        case 'uniform1fv': result[uniformName] = { value: uniform.value, type: '1fv' }; break;
        case 'uniform3fv': result[uniformName] = { value: (uniform.value as number[][]).map((v) => new THREE.Vector3().fromArray(v)), type: '3fv' }; break;
        case 'uniform2f': result[uniformName] = { value: new THREE.Vector2().fromArray(uniform.value as number[]), type: '2f' }; break;
      }
    }
    result.u_time = { value: 0, type: '1f' };
    result.u_resolution = { value: new THREE.Vector2(size.width * 2, size.height * 2) };
    return result;
  }, [size.width, size.height, source, uniforms]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `precision mediump float; in vec2 coordinates; uniform vec2 u_resolution; out vec2 fragCoord; void main(){ float x = position.x; float y = position.y; gl_Position = vec4(x, y, 0.0, 1.0); fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution; fragCoord.y = u_resolution.y - fragCoord.y; }`,
    fragmentShader: source,
    uniforms: preparedUniforms,
    glslVersion: THREE.GLSL3,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
  }), [size.width, size.height, source]);

  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const AnimatedNavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="group relative inline-block overflow-hidden h-5 flex items-center text-sm font-body">
    <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
      <span className="text-[#a8a294]">{children}</span>
      <span className="text-[#f0ede4]">{children}</span>
    </div>
  </Link>
);

function MiniNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isRegisterPage = location.pathname === '/register';

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current);
    if (isOpen) {
      setHeaderShapeClass('rounded-[20px]');
    } else {
      shapeTimeoutRef.current = setTimeout(() => setHeaderShapeClass('rounded-full'), 300);
    }
    return () => { if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current); };
  }, [isOpen]);

  const logoElement = (
    <div className="relative w-5 h-5 flex items-center justify-center">
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] top-0 left-1/2 -translate-x-1/2 opacity-80" />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] left-0 top-1/2 -translate-y-1/2 opacity-80" />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] right-0 top-1/2 -translate-y-1/2 opacity-80" />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] bottom-0 left-1/2 -translate-x-1/2 opacity-80" />
    </div>
  );

  const navLinksData = [
    { label: 'Manifesto', to: '/manifesto' },
    { label: 'Discover', to: '/discover' },
  ];

  const baseButtonClass = "relative z-10 block px-4 py-2 sm:px-3 text-xs sm:text-sm rounded-full transition-all duration-200 w-full sm:w-auto text-center border font-body";

  const loginButtonElement = (
    <Link to="/login" className="relative group w-full sm:w-auto inline-block">
      {isLoginPage && (
        <div className="absolute inset-0 -m-3 rounded-full bg-amber-500 opacity-20 blur-2xl pointer-events-none" />
      )}
      <span className={`${baseButtonClass} ${isLoginPage ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 'border-[#3a3730] text-[#a8a294] bg-transparent hover:border-[#5c574c] hover:text-[#f0ede4]'}`}>
        Login
      </span>
    </Link>
  );

  const signupButtonElement = (
    <Link to="/register" className="relative group w-full sm:w-auto inline-block">
      {isRegisterPage && (
        <div className="absolute inset-0 -m-3 rounded-full bg-amber-500 opacity-20 blur-2xl pointer-events-none" />
      )}
      <span className={`${baseButtonClass} ${isRegisterPage ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 'border-[#3a3730] text-[#a8a294] bg-transparent hover:border-[#5c574c] hover:text-[#f0ede4]'}`}>
        Sign Up
      </span>
    </Link>
  );

  return (
    <header className={`fixed top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pl-6 pr-6 py-3 backdrop-blur-sm ${headerShapeClass} border border-[#3a3730] bg-[#171510]/80 w-[calc(100%-2rem)] sm:w-auto transition-[border-radius] duration-0 ease-in-out`}>
      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        <Link to="/" className="flex items-center">{logoElement}</Link>
        <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
          {navLinksData.map((link) => (
            <AnimatedNavLink key={link.to} to={link.to}>{link.label}</AnimatedNavLink>
          ))}
        </nav>
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          {loginButtonElement}
          {signupButtonElement}
        </div>
        <button className="sm:hidden flex items-center justify-center w-8 h-8 text-[#a8a294] focus:outline-none" onClick={toggleMenu} aria-label={isOpen ? 'Close Menu' : 'Open Menu'}>
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>
      <div className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          {navLinksData.map((link) => (
            <Link key={link.to} to={link.to} className="text-[#a8a294] hover:text-[#f0ede4] transition-colors w-full text-center font-body">{link.label}</Link>
          ))}
        </nav>
        <div className="flex flex-col items-center space-y-4 mt-4 w-full">
          {loginButtonElement}
          {signupButtonElement}
        </div>
      </div>
    </header>
  );
}

interface PublicLayoutProps {
  children: React.ReactNode;
  reverse?: boolean;
  className?: string;
}

export function PublicLayout({ children, reverse = false, className }: PublicLayoutProps) {
  return (
    <div className={cn('flex w-[100%] flex-col min-h-screen relative', className)}
      style={{ background: '#0a0a08' }}>
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0">
          <DotMatrixWithAnimationSpeed
            animationSpeed={reverse ? 4 : 3}
            colors={[[245, 240, 230], [245, 240, 230]]}
            dotSize={6}
            reverse={reverse}
          />
        </div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, rgba(10,10,8,1) 0%, transparent 100%)' }} />
        <div className="absolute top-0 left-0 right-0 h-1/3" style={{ background: 'linear-gradient(to bottom, #0a0a08, transparent)' }} />
      </div>
      <div className="relative z-10 flex flex-col flex-1">
        <MiniNavbar />
        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="flex-1 flex flex-col justify-center items-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const DotMatrixWithAnimationSpeed: React.FC<{
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ('x' | 'y')[];
  animationSpeed?: number;
  reverse?: boolean;
}> = ({ animationSpeed = 3, reverse = false, ...props }) => {
  return (
    <div className="h-full w-full">
      <DotMatrix
        {...props}
        shader={`${reverse ? 'u_reverse_active' : 'false'}_; animation_speed_factor_${animationSpeed.toFixed(1)}_;`}
      />
    </div>
  );
};

export default PublicLayout;
