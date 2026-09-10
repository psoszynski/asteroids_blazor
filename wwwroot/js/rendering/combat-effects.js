import * as THREE from 'three';
import { EffectState } from './effect-state.js';

export function createCombatEffects(scene, own) {
    const state = new EffectState();
    const ringGeometry = own(new THREE.RingGeometry(0.91, 1, 48));
    const flashGeometry = own(new THREE.CircleGeometry(1, 24));
    const fragmentGeometry = own(new THREE.IcosahedronGeometry(1, 0));
    const slots = Array.from({ length: 24 }, () => {
        const material = () => own(new THREE.MeshBasicMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        const group = new THREE.Group();
        const ring = new THREE.Mesh(ringGeometry, material());
        const flash = new THREE.Mesh(flashGeometry, material());
        const debris = new THREE.InstancedMesh(fragmentGeometry, own(new THREE.MeshStandardMaterial({
            color: '#847263', roughness: 1, transparent: true
        })), 12);
        const sparks = new THREE.InstancedMesh(flashGeometry, material(), 20);
        const dust = new THREE.InstancedMesh(flashGeometry, own(new THREE.MeshBasicMaterial({
            color: '#897e70', transparent: true, opacity: 0, depthWrite: false
        })), 8);
        group.add(ring, flash, debris, sparks, dust);
        scene.add(group); group.visible = false;
        return { group, ring, flash, debris, sparks, dust };
    });
    const lights = Array.from({ length: 4 }, () => {
        const light = new THREE.PointLight('#ff9a46', 0, 220, 1.4);
        scene.add(light); return light;
    });
    const engineLight = new THREE.PointLight('#47cfff', 0, 100, 1.4);
    scene.add(engineLight);
    const dummy = new THREE.Object3D();
    const colorFor = event => event.type === 'shield' ? '#63e8ff'
        : event.type === 'pickup' ? ['#67efff', '#ffe47a', '#ff90ef'][event.direction] || '#67efff'
        : '#ff9b42';
    return {
        update(frame, deltaMs) {
            const bursts = state.update(frame, deltaMs);
            for (const light of lights) light.intensity = 0;
            let lightIndex = 0;
            slots.forEach((slot, index) => {
                const b = bursts[index]; slot.group.visible = !!b;
                if (!b) return;
                const age = b.age, fade = Math.max(0, 1 - age / 1.2);
                const reduced = !!frame.reducedEffects;
                slot.debris.count = frame.lowQuality ? 6 : 12;
                slot.sparks.count = frame.lowQuality ? 10 : 20;
                slot.dust.count = frame.lowQuality ? 4 : 8;
                const color = colorFor(b);
                slot.group.position.set(b.x, -b.y, 35);
                slot.ring.material.color.set(color);
                slot.ring.material.opacity = Math.max(0, 1 - age / 0.65) * 0.65;
                if (reduced) slot.ring.material.opacity *= 0.35;
                slot.ring.scale.setScalar(b.scale * (0.45 + age * 3));
                slot.flash.material.color.set(color);
                slot.flash.material.opacity = Math.max(0, 1 - age / 0.18) * 0.8;
                slot.flash.visible = !reduced;
                slot.flash.scale.setScalar(b.scale * (0.25 + age * 2));
                slot.debris.visible = b.type === 'asteroid' && !reduced;
                slot.debris.material.opacity = fade;
                slot.dust.visible = b.type === 'asteroid' && !reduced;
                slot.sparks.visible = !reduced;
                slot.dust.material.opacity = Math.min(age * 2, 0.12) * fade;
                slot.sparks.material.color.set(color);
                slot.sparks.material.opacity = fade * fade;
                for (let i = 0; i < 20; i++) {
                    const angle = i * 2.39996 + b.id * 1.73;
                    const speed = b.scale * (1.2 + (i % 5) * 0.4);
                    const travel = speed * age;
                    dummy.position.set(Math.cos(angle) * travel, Math.sin(angle) * travel, i % 3);
                    dummy.rotation.set(age * (i + 1), age * 2, angle);
                    dummy.scale.set(0.7 + fade, (1 + fade * 5), 1);
                    dummy.updateMatrix(); slot.sparks.setMatrixAt(i, dummy.matrix);
                    if (i < 12) {
                        dummy.scale.setScalar(Math.max(0.01, b.scale * (0.035 + (i % 3) * 0.018) * fade));
                        dummy.updateMatrix(); slot.debris.setMatrixAt(i, dummy.matrix);
                    }
                    if (i < 8) {
                        dummy.position.multiplyScalar(0.45);
                        dummy.rotation.set(0, 0, angle);
                        dummy.scale.setScalar(b.scale * (0.10 + age * 0.2));
                        dummy.updateMatrix(); slot.dust.setMatrixAt(i, dummy.matrix);
                    }
                }
                slot.sparks.instanceMatrix.needsUpdate = true;
                slot.debris.instanceMatrix.needsUpdate = true;
                slot.dust.instanceMatrix.needsUpdate = true;
                // Instances travel beyond their initial geometry bounds.
                slot.sparks.frustumCulled = slot.debris.frustumCulled = false;
                slot.dust.frustumCulled = false;
                if (!reduced && age < 0.25 && lightIndex < (frame.lowQuality ? 2 : lights.length)) {
                    const light = lights[lightIndex++];
                    light.position.set(b.x, -b.y, 45); light.color.set(color);
                    light.intensity = 90 * (1 - age / 0.25);
                }
            });
            engineLight.intensity = frame.drawPlayer && frame.thrusting ? 18 : 0;
            if (frame.player) engineLight.position.set(
                frame.player.x - Math.cos(frame.player.rotation) * 23,
                -frame.player.y + Math.sin(frame.player.rotation) * 23, 12);
        },
        reset() { state.reset(); slots.forEach(s => { s.group.visible = false; });
            lights.forEach(l => { l.intensity = 0; }); engineLight.intensity = 0; },
        dispose() {
            slots.forEach(s => { s.debris.dispose(); s.sparks.dispose(); s.dust.dispose(); scene.remove(s.group); });
            [...lights, engineLight].forEach(l => scene.remove(l));
            state.reset();
        }
    };
}
