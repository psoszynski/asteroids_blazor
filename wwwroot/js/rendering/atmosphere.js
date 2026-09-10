import * as THREE from 'three';

export function createAtmosphere(scene, own) {
    const uniforms = { travel: { value: new THREE.Vector2() }, aspect: { value: 1 }, time: { value: 0 } };
    const material = own(new THREE.ShaderMaterial({
        uniforms, depthWrite: false,
        vertexShader: `varying vec2 vUv; void main() { vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform vec2 travel; uniform float aspect; uniform float time;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
                return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
            float cloud(vec2 p) { return noise(p)*0.55 + noise(p*2.1)*0.28 + noise(p*4.3)*0.12; }
            vec3 planet(vec2 p, vec2 center, float radius, vec3 tint) {
                vec2 q = (p-center)/radius; float d = length(q);
                float rim = exp(-abs(d-1.0)*40.0)*0.05;
                float z = sqrt(max(0.0,1.0-dot(q,q)));
                float light = max(0.0,dot(normalize(vec3(q,z)),normalize(vec3(-0.7,0.7,0.5))));
                float bands = 0.65 + 0.35*cloud(q*vec2(5.0,14.0));
                return tint * (rim + (1.0-smoothstep(0.97,1.0,d))*(0.008+light*0.06)*bands);
            }
            void main() {
                vec2 p = vec2(vUv.x*aspect,vUv.y);
                vec2 drifting = p + travel;
                float mist = pow(cloud(drifting*3.0+vec2(8.0,2.0)),3.0);
                float ribbon = exp(-pow((p.y-0.55-sin(p.x*3.0)*0.15)*3.0,2.0));
                vec3 color = vec3(0.0015,0.003,0.008) + mix(vec3(0.024,0.039,0.105),vec3(0.09,0.024,0.081),cloud(drifting*2.0))*mist*ribbon;
                color += planet(p,vec2(aspect*0.83,0.74)+travel*0.15,0.16,vec3(0.25,0.45,0.7));
                color += planet(p,vec2(aspect*0.15,0.2)+travel*0.08,0.055,vec3(0.6,0.4,0.25));
                vec2 dustUv = drifting*75.0 + vec2(time*0.04,0);
                float dust = pow(max(0.0,1.0-length(fract(dustUv)-0.5)*2.0),8.0)*step(0.995,hash(floor(dustUv)));
                color += dust*vec3(0.025,0.035,0.045);
                gl_FragColor = vec4(color,1.0);
            }`
    }));
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), material);
    mesh.position.z = -180;
    scene.add(mesh);
    return {
        update(frame, deltaMs, reduced) {
            const w = frame.canvasWidth, h = frame.canvasHeight;
            mesh.position.set(w/2, -h/2, -180); mesh.scale.set(w,h,1);
            uniforms.aspect.value = w/h;
            if (!frame.isPaused && !reduced) {
                const dt = Math.min(deltaMs,50)/1000;
                uniforms.time.value += dt;
                // Integrate velocity rather than wrapped positions for continuous travel.
                uniforms.travel.value.x += (frame.player?.velocityX || 0)*dt*0.000015;
                uniforms.travel.value.y -= (frame.player?.velocityY || 0)*dt*0.000015;
            }
        },
        get travel() { return uniforms.travel.value; },
        starVisible(x, y, width, height) {
            const p = { x: x / height, y: 1 - y / height };
            const t = uniforms.travel.value;
            return Math.hypot(p.x - (width / height * 0.83 + t.x * 0.15), p.y - (0.74 + t.y * 0.15)) > 0.16
                && Math.hypot(p.x - (width / height * 0.15 + t.x * 0.08), p.y - (0.2 + t.y * 0.08)) > 0.055;
        },
        reset() { uniforms.travel.value.set(0,0); uniforms.time.value = 0; },
        dispose() { scene.remove(mesh); }
    };
}
