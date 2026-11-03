import { Container, Graphics, Point, Text, Sprite } from 'pixi.js';
import { assign as _extend } from 'lodash/object';

export const HUD_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Text is rendered above 1x so it stays sharp when the stage is scaled to the window
export const TEXT_RESOLUTION = 2;

const PANEL_STYLE = {
  fill: { color: 0x0b1324, alpha: 0.45 },
  stroke: { width: 1, color: 0xffffff, alpha: 0.18 },
  radius: 10
};

const BUTTON_HEIGHT = 28;
const BUTTON_PADDING_X = 12;
const BUTTON_GAP = 8;
const BUTTON_STYLE = {
  fontFamily: HUD_FONT,
  fontSize: '13px',
  fontWeight: '600',
  fill: 'white'
};

/**
 * drawPanel
 * Draws the translucent rounded card used behind every HUD element.
 * @param {Graphics} graphics
 * @param {{x:Number, y:Number, width:Number, height:Number}} rect
 * @param {Number} radius
 */
export function drawPanel(graphics, rect, radius = PANEL_STYLE.radius) {
  graphics.clear()
    .roundRect(rect.x, rect.y, rect.width, rect.height, radius)
    .fill(PANEL_STYLE.fill)
    .stroke(PANEL_STYLE.stroke);
}

/**
 * localRect
 * Rectangle occupied by a text box or counter in the Hud's coordinate space.
 */
function localRect(item) {
  const anchor = item.anchor || { x: 0, y: 0 };
  return {
    x: item.x - anchor.x * item.width,
    y: item.y - anchor.y * item.height,
    width: item.width,
    height: item.height
  };
}

/**
 * Hud
 * The heads up display class, or Hud is an abstraction that aids in the creation
 * and visual updating of text boxes that display useful information to the
 * user as they play the game.
 *
 * The instantiator of this class is responsible for displaying it at the proper
 * depth in it's parent container.
 */
class Hud extends Container {
  constructor({ textures }) {
    super();
    this.textures = textures;
    this.panels = {};
    this.buttons = [];
    this.toolbar = new Container();
    this.addChild(this.toolbar);
  }

  /**
   * createTextBox
   * This method defines a property key on the Hud object that when modified
   * ensures the text box is visually updated. This is accomplished using ES6 getters
   * and setters.
   * @param name string - This name becomes a property key on the Hud object,
   *   modifying it will update the textBox automatically.
   * @param opts object - Object to convey style, location, anchor point, etc of the text box
   * @param opts.panel string - Optional panel name, elements sharing a panel are drawn on the same card
   * @param opts.format function - Optional formatter applied to the value before it is displayed
   */
  createTextBox(name, opts) {
    // set defaults, and allow them to be overwritten
    const options = _extend({
      style: {
        fontFamily: HUD_FONT,
        fontSize: '18px',
        fontWeight: '600',
        align: 'left',
        fill: 'white'
      },
      location: new Point(0, 0),
      anchor: {
        x: 0.5,
        y: 0.5
      }
    }, opts);

    this[name + 'TextBox'] = new Text({ text: '', style: options.style, resolution: TEXT_RESOLUTION });
    const textBox = this[name + 'TextBox'];
    textBox.position.set(options.location.x, options.location.y);
    textBox.anchor.set(options.anchor.x, options.anchor.y);
    this.addChild(textBox);
    this._addToPanel(options.panel, textBox, options.panelPadding);

    Object.defineProperty(this, name, {
      set: (val) => {
        textBox.text = options.format && val !== '' ? options.format(val) : val;
        this._redrawPanel(options.panel);
      },
      get: () => {
        return textBox.text;
      }
    });
  }

  createTextureBasedCounter(name, opts) {
    const options = _extend({
      texture: '',
      spritesheet: '',
      location: new Point(0, 0)
    }, opts);

    this[name + 'Container'] = new Container();
    const container = this[name + 'Container'];
    container.position.set(options.location.x, options.location.y);
    this.addChild(container);
    this._addToPanel(options.panel, container, options.panelPadding);

    Object.defineProperty(this, name, {
      set: (val) => {
        const texture = this.textures[options.texture];
        const childCount = container.children.length;
        if (options.max && val > options.max) {
          val = options.max;
        }
        if (childCount < val) {
          for (let i = childCount; i < val; i++) {
            const item = new Sprite(texture);
            let yPos = 0;
            let xPosDelta = i;
            if (options.rowMax && options.rowMax < val) {
              yPos = item.height * Math.floor(i / options.rowMax);
              xPosDelta = i % options.rowMax;
            }
            item.position.set(item.width * xPosDelta, yPos);
            container.addChild(item);
          }
        } else if (val != childCount) {
          container.removeChildren(val, childCount);
        }
        this._redrawPanel(options.panel);
      }
    });
  }

  /**
   * createButton
   * Adds a pill shaped button to the toolbar anchored at the bottom right of the Hud. Like text boxes,
   * the button label is exposed as a property on the Hud object.
   * @param name string - Property key used to read/update the button label
   * @param opts.location Point - Bottom right corner of the toolbar
   */
  createButton(name, opts) {
    this.toolbar.position.set(opts.location.x, opts.location.y);

    const button = new Container();
    const background = new Graphics();
    const label = new Text({ text: '', style: BUTTON_STYLE, resolution: TEXT_RESOLUTION });
    label.anchor.set(0.5, 0.5);
    label.y = BUTTON_HEIGHT / 2;
    button.addChild(background, label);
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const draw = (alpha) => {
      const width = label.width + BUTTON_PADDING_X * 2;
      label.x = width / 2;
      background.clear()
        .roundRect(0, 0, width, BUTTON_HEIGHT, BUTTON_HEIGHT / 2)
        .fill({ color: PANEL_STYLE.fill.color, alpha })
        .stroke(PANEL_STYLE.stroke);
    };
    button.on('pointerover', () => draw(0.7));
    button.on('pointerout', () => draw(PANEL_STYLE.fill.alpha));

    this[name + 'Button'] = button;
    this.toolbar.addChild(button);
    this.buttons.push(button);

    Object.defineProperty(this, name, {
      set: (val) => {
        label.text = val;
        draw(PANEL_STYLE.fill.alpha);
        this._layoutToolbar();
      },
      get: () => {
        return label.text;
      }
    });
  }

  /**
   * buttonContains
   * @param name string - Name the button was created with
   * @param {{x:Number, y:Number}} globalPoint - Point in screen coordinates
   * @returns {Boolean}
   */
  buttonContains(name, globalPoint) {
    const button = this[name + 'Button'];
    return Boolean(button) && button.getBounds().containsPoint(globalPoint.x, globalPoint.y);
  }

  _layoutToolbar() {
    // buttons are laid out left to right so that the last one touches the toolbar's anchor
    let x = 0;
    this.buttons.forEach((button) => {
      button.position.set(x, -BUTTON_HEIGHT);
      x += button.width + BUTTON_GAP;
    });
    this.buttons.forEach((button) => {
      button.x -= x - BUTTON_GAP;
    });
  }

  _addToPanel(panelName, item, padding = { x: 12, y: 7 }) {
    if (!panelName) {
      return;
    }
    if (!this.panels[panelName]) {
      const graphics = new Graphics();
      this.addChildAt(graphics, 0);
      this.panels[panelName] = { graphics, padding, items: [] };
    }
    this.panels[panelName].items.push(item);
  }

  _redrawPanel(panelName) {
    const panel = this.panels[panelName];
    if (!panel) {
      return;
    }

    const rects = panel.items
      .filter((item) => item.width > 0 && item.height > 0 && item.text !== '')
      .map(localRect);

    panel.graphics.visible = rects.length > 0;
    if (!rects.length) {
      return;
    }

    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.width));
    const maxY = Math.max(...rects.map((r) => r.y + r.height));
    drawPanel(panel.graphics, {
      x: minX - panel.padding.x,
      y: minY - panel.padding.y,
      width: maxX - minX + panel.padding.x * 2,
      height: maxY - minY + panel.padding.y * 2
    });
  }
}

export default Hud;
