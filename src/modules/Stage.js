import { Point, Container, Sprite } from 'pixi.js';

import BPromise from 'bluebird';
import { some as _some } from 'lodash/collection';
import Utils from '../libs/utils';
import Duck from './Duck';
import Dog from './Dog';
import Hud from './Hud';
import Aim from './Aim';
import Effects from './Effects';

const MAX_X = 800;
const MAX_Y = 600;

const DUCK_POINTS = {
  ORIGIN: new Point(MAX_X / 2, MAX_Y)
};
const DOG_POINTS = {
  DOWN: new Point(MAX_X / 2, MAX_Y),
  UP: new Point(MAX_X / 2, MAX_Y - 230),
  SNIFF_START: new Point(0, MAX_Y - 130),
  SNIFF_END: new Point(MAX_X / 2, MAX_Y - 130)
};
// locations are inset from the edges so the translucent panels drawn around them stay on screen
const HUD_LOCATIONS = {
  SCORE: new Point(MAX_X - 22, 16),
  WAVE_STATUS: new Point(MAX_X - 22, 42),
  TOOLBAR: new Point(MAX_X - 10, MAX_Y - 10),
  GAME_STATUS: new Point(MAX_X / 2, MAX_Y * 0.45),
  REPLAY_BUTTON: new Point(MAX_X / 2, MAX_Y * 0.56),
  BULLET_STATUS: new Point(22, 17),
  DEAD_DUCK_STATUS: new Point(22, MAX_Y - 70),
  MISSED_DUCK_STATUS: new Point(22, MAX_Y - 46)
};

class Stage extends Container {

  /**
   * Stage Constructor
   * Container for the game
   * @param opts
   * @param opts.spritesheet - String representing the path to the spritesheet file
   */
  constructor({ textures }) {
    super();
    this.textures = textures

    this.locked = false;
    this.interactive = true;
    this.ducks = [];
    this.dog = new Dog({
      textures: textures,
      downPoint: DOG_POINTS.DOWN,
      upPoint: DOG_POINTS.UP
    });
    this.dog.visible = false;
    this.effects = new Effects({
      width: MAX_X,
      height: MAX_Y
    });
    this.hud = new Hud({ textures: textures });
    this.aim = new Aim({
      textures: textures,
      maxX: MAX_X,
      maxY: MAX_Y
    });
    this._setStage();
    this.scaleToWindow();
  }

  static scoreBoxLocation() {
    return HUD_LOCATIONS.SCORE;
  }

  static waveStatusBoxLocation() {
    return HUD_LOCATIONS.WAVE_STATUS;
  }

  static gameStatusBoxLocation() {
    return HUD_LOCATIONS.GAME_STATUS;
  }

  static toolbarLocation() {
    return HUD_LOCATIONS.TOOLBAR;
  }

  static replayButtonLocation() {
    return HUD_LOCATIONS.REPLAY_BUTTON;
  }

  static bulletStatusBoxLocation() {
    return HUD_LOCATIONS.BULLET_STATUS;
  }

  static deadDuckStatusBoxLocation() {
    return HUD_LOCATIONS.DEAD_DUCK_STATUS;
  }

  static missedDuckStatusBoxLocation() {
    return HUD_LOCATIONS.MISSED_DUCK_STATUS;
  }

  pause() {
    this.dog.timeline.pause();
    this.ducks.forEach((duck) => {
      duck.timeline.pause();
    });
  }

  resume() {
    this.dog.timeline.play();
    this.ducks.forEach((duck) => {
      duck.timeline.play();
    });
  }

  /**
   * scaleToWindow
   * Helper method that scales the stage container to the window size
   */
  scaleToWindow() {
    this.scale.set(window.innerWidth / MAX_X, window.innerHeight / MAX_Y);
  }

  /**
   * _setStage
   * Private method that adds all of the main pieces to the scene
   * @returns {Stage}
   * @private
   */
  _setStage() {
    const background = new Sprite(this.textures['scene/back/0.png']);
    background.position.set(0, 0);

    const tree = new Sprite(this.textures['scene/tree/0.png']);
    tree.position.set(100, 237);

    this.addChild(tree);
    this.addChild(background);
    this.addChild(this.dog);
    this.addChild(this.effects);
    this.addChild(this.hud);
    this.addChild(this.aim);

    return this;
  }

  /**
   * preLevelAnimation
   * Helper method that runs the level intro animation with the dog and returns a promise that resolves
   * when it's complete.
   * @returns {Promise}
   */
  preLevelAnimation() {
    return new BPromise((resolve) => {
      this.cleanUpDucks();
      this.dog.sniff({
        startPoint: DOG_POINTS.SNIFF_START,
        endPoint: DOG_POINTS.SNIFF_END
      }).find({
        onComplete: () => {
          this.setChildIndex(this.dog, 0);
          resolve();
        }
      });
    });
  }

  /**
   * addDucks
   * Helper method that adds ducks to the container and causes them to fly around randomly.
   * @param {Number} numDucks - How many ducks to add to the stage
   * @param {Number} speed - Value from 0 (slow) to 10 (fast) that determines how fast the ducks will fly
   */
  addDucks(numDucks, speed) {
    for (let i = 0; i < numDucks; i++) {
      const duckColor = i % 2 === 0 ? 'red' : 'black';

      // Al was here.
      const newDuck = new Duck({
        textures: this.textures,
        colorProfile: duckColor,
        maxX: MAX_X,
        maxY: MAX_Y
      });
      newDuck.position.set(DUCK_POINTS.ORIGIN.x, DUCK_POINTS.ORIGIN.y);
      this.addChildAt(newDuck, 0);
      newDuck.randomFlight({
        speed
      });

      this.ducks.push(newDuck);
    }
  }

  /**
   * shotsFired
   * Click handler for the stage, scale's the location of the click to ensure coordinate system
   * alignment and then calculates if any of the ducks were hit and should be shot.
   * @param {{x:Number, y:Number}} clickPoint - Point where the container was clicked in real coordinates
   * @param {Number} radius - The "blast radius" of the player's weapon
   * @param {Number} pointsPerDuck - Points shown in the popup over each duck hit
   * @returns {Number} - The number of ducks hit with the shot
   */
  shotsFired(clickPoint, radius, pointsPerDuck = 0) {
    const shotPoint = this.getScaledClickLocation(clickPoint);
    this.effects.flash();
    this.effects.impact(shotPoint, radius);

    let ducksShot = 0;
    for (let i = 0; i < this.ducks.length; i++) {
      const duck = this.ducks[i];
      if (duck.alive && Utils.pointDistance(duck.position, shotPoint) < radius) {
        ducksShot++;
        this.effects.hit(duck.position, pointsPerDuck);
        duck.shot();
        duck.timeline.add(() => {
          if (!this.isLocked()) {
            this.dog.retrieve();
          }
        });
      }
    }
    return ducksShot;
  }

  clickedReplay(clickPoint) {
    // this link is in the middle of the page, general radius search is sufficient here
    return Utils.pointDistance(this.getScaledClickLocation(clickPoint), HUD_LOCATIONS.REPLAY_BUTTON) < 200;
  }

  clickedLevelCreatorLink(clickPoint) {
    return this.hud.buttonContains('levelCreatorLink', clickPoint);
  }

  clickedPauseLink(clickPoint) {
    return this.hud.buttonContains('pauseLink', clickPoint);
  }

  clickedFullscreenLink(clickPoint) {
    return this.hud.buttonContains('fullscreenLink', clickPoint);
  }

  clickedMuteLink(clickPoint) {
    return this.hud.buttonContains('muteLink', clickPoint);
  }

  getScaledClickLocation(clickPoint) {
    return {
      x: clickPoint.x / this.scale.x,
      y: clickPoint.y / this.scale.y
    };
  }
  /**
   * flyAway
   * Helper method that causes the sky to change color and the ducks to fly away
   * @returns {Promise} - This promise is resolved when all the ducks have flown away
   */
  flyAway() {
    this.dog.stopAndClearTimeline();
    this.dog.laugh();
    this.lock();

    const duckPromises = this.ducks
      .filter((d) => d.alive)
      .map((duck) => new BPromise((resolve) => {
        duck.stopAndClearTimeline();
        duck.flyTo({
          point: new Point(MAX_X / 2, -500),
          onComplete: resolve
        });
      }));

    return BPromise.all(duckPromises)
      .then(this.cleanUpDucks.bind(this))
      .then(this.unlock.bind(this));
  }

  /**
   * cleanUpDucks
   * Helper that removes all ducks from the container and object
   */
  cleanUpDucks() {
    this.ducks.forEach((duck) => this.removeChild(duck));
    this.ducks = [];
  }

  /**
   * ducksAlive
   * Helper that returns a boolean value depending on whether or not ducks are alive. The distinction
   * is that even dead ducks may be animating and still "active"
   * @returns {Boolean}
   */
  ducksAlive() {
    return _some(this.ducks, (duck) => {
      return duck.alive;
    });
  }

  /**
   * ducksActive
   * Helper that returns a boolean value depending on whether or not ducks are animating. Both live
   * and dead ducks may be animating.
   * @returns {Boolean}
   */
  ducksActive() {
    return _some(this.ducks, (duck) => {
      return duck.isActive();
    });
  }

  /**
   * dogActive
   * Helper proxy method that returns a boolean depending on whether the dog is animating
   * @returns {boolean}
   */
  dogActive() {
    return this.dog.isActive();
  }

  /**
   * isActive
   * High level helper to determine if things are animating on the stage
   * @returns {boolean|Boolean}
   */
  isActive() {
    return this.dogActive() || this.ducksAlive() || this.ducksActive();
  }

  /**
   * lock
   * Lock the stage to prevent new animations from being added to timelines, specifically useful for managing race and
   * edge conditions around dogs and ducks.
   */
  lock() {
    this.locked = true;
  }

  /**
   * unlock
   * Unlock the stage so that new animations can be added to timelines.
   */
  unlock() {
    this.locked = false;
  }

  /**
   * isLocked
   * Helper to tell if the stage is locked to new animations or not
   * @returns {Boolean}
   */
  isLocked() {
    return this.locked;
  }
}

export default Stage;
