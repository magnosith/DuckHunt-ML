import { Container, Graphics, Text } from 'pixi.js';
import { TweenMax } from 'gsap';
import { random as _random } from 'lodash/number';
import { HUD_FONT, TEXT_RESOLUTION } from './Hud';

const PARTICLE_COLORS = [0xffffff, 0xffe066, 0xffb347];
const PARTICLES_PER_HIT = 8;
const SCORE_POPUP_STYLE = {
  fontFamily: HUD_FONT,
  fontSize: '22px',
  fontWeight: '800',
  fill: 0xffe066,
  stroke: { color: 0x1a1200, width: 4 },
};

/**
 * Effects
 * Short lived visual feedback for shots: a soft screen flash, an impact ring showing the blast
 * radius and, when a duck is hit, a burst of particles plus a floating score popup.
 * Every element removes itself once its tween completes.
 */
class Effects extends Container {
  constructor({ width, height }) {
    super();
    this.eventMode = 'none';

    this.flashScreen = new Graphics().rect(0, 0, width, height).fill(0xffffff);
    this.flashScreen.alpha = 0;
    this.addChild(this.flashScreen);
  }

  flash() {
    TweenMax.killTweensOf(this.flashScreen);
    this.flashScreen.alpha = 0.3;
    TweenMax.to(this.flashScreen, 0.15, { alpha: 0 });
  }

  /**
   * impact
   * @param {{x:Number, y:Number}} point - Shot location in stage coordinates
   * @param {Number} radius - Blast radius of the weapon
   */
  impact(point, radius) {
    const ring = new Graphics()
      .circle(0, 0, radius)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
    ring.position.set(point.x, point.y);
    ring.scale.set(0.3);
    this.addChild(ring);

    TweenMax.to(ring.scale, 0.3, { x: 1, y: 1 });
    TweenMax.to(ring, 0.3, {
      alpha: 0,
      onComplete: () => ring.destroy()
    });
  }

  /**
   * hit
   * @param {{x:Number, y:Number}} point - Location of the duck that was hit
   * @param {Number} points - Points earned, shown as a floating popup when greater than zero
   */
  hit(point, points) {
    for (let i = 0; i < PARTICLES_PER_HIT; i++) {
      const size = _random(3, 6);
      const particle = new Graphics()
        .rect(-size / 2, -size / 2, size, size)
        .fill(PARTICLE_COLORS[i % PARTICLE_COLORS.length]);
      particle.position.set(point.x, point.y);
      this.addChild(particle);

      const angle = (Math.PI * 2 * i) / PARTICLES_PER_HIT + _random(-0.3, 0.3, true);
      const distance = _random(30, 60);
      TweenMax.to(particle, 0.5, {
        x: point.x + Math.cos(angle) * distance,
        y: point.y + Math.sin(angle) * distance,
        alpha: 0,
        rotation: _random(-3, 3, true),
        onComplete: () => particle.destroy()
      });
    }

    if (points > 0) {
      const popup = new Text({ text: `+${points}`, style: SCORE_POPUP_STYLE, resolution: TEXT_RESOLUTION });
      popup.anchor.set(0.5, 1);
      popup.position.set(point.x, point.y - 20);
      this.addChild(popup);

      TweenMax.to(popup, 0.9, {
        y: popup.y - 45,
        alpha: 0,
        onComplete: () => popup.destroy()
      });
    }
  }
}

export default Effects;
