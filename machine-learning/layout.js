// layout.js
// UI layer for the AI player. It lives on app.stage (outside game.stage), so nothing drawn here
// ends up in the frames captured for YOLO.
import * as PIXI from 'pixi.js';
import { HUD_FONT, TEXT_RESOLUTION, drawPanel } from '../src/modules/Hud';

const CROSSHAIR_RADIUS = 18;
// how quickly the crosshair glides towards a new prediction (higher = snappier)
const FOLLOW_SPEED = 14;
// hide the crosshair when the model hasn't seen a duck for this long
const IDLE_MS = 700;

const CONFIDENCE_COLORS = [
    { min: 70, color: 0x4ade80 },
    { min: 50, color: 0xfacc15 },
    { min: 0, color: 0xfb923c },
];

function confidenceColor(score) {
    return CONFIDENCE_COLORS.find(({ min }) => score >= min).color;
}

function buildCrosshair() {
    const crosshair = new PIXI.Container();
    crosshair.eventMode = 'none';
    crosshair.alpha = 0;

    const drawReticle = (stroke) => new PIXI.Graphics()
        .circle(0, 0, CROSSHAIR_RADIUS)
        .stroke(stroke)
        .moveTo(-CROSSHAIR_RADIUS - 8, 0).lineTo(-CROSSHAIR_RADIUS + 6, 0)
        .moveTo(CROSSHAIR_RADIUS - 6, 0).lineTo(CROSSHAIR_RADIUS + 8, 0)
        .moveTo(0, -CROSSHAIR_RADIUS - 8).lineTo(0, -CROSSHAIR_RADIUS + 6)
        .moveTo(0, CROSSHAIR_RADIUS - 6).lineTo(0, CROSSHAIR_RADIUS + 8)
        .stroke(stroke)
        .circle(0, 0, 2.5)
        .fill({ color: stroke.color, alpha: stroke.alpha });

    // white lines over a dark halo: the container tint colors the lines by confidence
    // while the black halo keeps the crosshair readable against the sky
    const reticle = new PIXI.Container();
    reticle.addChild(
        drawReticle({ width: 5, color: 0x000000, alpha: 0.35 }),
        drawReticle({ width: 2, color: 0xffffff, alpha: 1 })
    );

    const label = new PIXI.Text({
        text: '',
        style: {
            fontFamily: HUD_FONT,
            fontSize: 12,
            fontWeight: '700',
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 3 },
        },
        resolution: TEXT_RESOLUTION,
    });
    label.anchor.set(0.5, 0);
    label.y = CROSSHAIR_RADIUS + 10;

    crosshair.addChild(reticle, label);
    return { crosshair, reticle, label };
}

function buildStatusPanel() {
    const panel = new PIXI.Container();
    const background = new PIXI.Graphics();
    const dot = new PIXI.Graphics().circle(0, 0, 4).fill(0xffffff);
    const text = new PIXI.Text({
        text: '',
        style: {
            fontFamily: HUD_FONT,
            fontSize: 13,
            fontWeight: '600',
            fill: 0xffffff,
        },
        resolution: TEXT_RESOLUTION,
    });
    text.anchor.set(0, 0.5);
    dot.position.set(14, 15);
    text.position.set(26, 15);
    panel.addChild(background, dot, text);

    function setStatus(message, color) {
        text.text = message;
        dot.tint = color;
        drawPanel(background, { x: 0, y: 0, width: text.width + 40, height: 30 }, 15);
    }

    return { panel, setStatus };
}

export function buildLayout(app) {
    const layer = new PIXI.Container();
    layer.zIndex = 1000;
    layer.eventMode = 'none';

    const { panel, setStatus } = buildStatusPanel();
    const { crosshair, reticle, label } = buildCrosshair();
    layer.addChild(crosshair, panel);

    app.stage.sortableChildren = true;
    app.stage.addChild(layer);

    const target = { x: 0, y: 0 };
    let lastPredictionAt = 0;

    function positionPanel() {
        panel.x = Math.round((app.renderer.width - panel.width) / 2);
        panel.y = 12;
    }

    function setLoading() {
        setStatus('AI · loading model…', 0x94a3b8);
        positionPanel();
    }

    function setReady() {
        setStatus('AI · scanning for ducks', 0x60a5fa);
        positionPanel();
    }

    /**
     * Moves the crosshair towards a new prediction.
     * @param {{x:Number, y:Number, score:String|Number}} prediction - x/y in screen coordinates
     */
    function updatePrediction({ x, y, score }) {
        const confidence = Number(score);
        const color = confidenceColor(confidence);

        // first sighting after being idle: jump straight there instead of gliding across the screen
        if (crosshair.alpha < 0.05) {
            crosshair.position.set(x, y);
        }
        target.x = x;
        target.y = y;
        lastPredictionAt = performance.now();

        reticle.tint = color;
        reticle.scale.set(1.35);
        label.text = `${Math.round(confidence)}%`;

        setStatus(`AI · target ${Math.round(confidence)}% · (${Math.round(x)}, ${Math.round(y)})`, color);
        positionPanel();
    }

    app.ticker.add((ticker) => {
        const dt = ticker.deltaMS / 1000;
        const follow = 1 - Math.exp(-FOLLOW_SPEED * dt);
        const settle = 1 - Math.exp(-10 * dt);

        crosshair.x += (target.x - crosshair.x) * follow;
        crosshair.y += (target.y - crosshair.y) * follow;
        reticle.scale.set(reticle.scale.x + (1 - reticle.scale.x) * settle);
        reticle.rotation += dt * 0.8;

        const visible = performance.now() - lastPredictionAt < IDLE_MS;
        crosshair.alpha += ((visible ? 1 : 0) - crosshair.alpha) * settle;

        if (!visible && lastPredictionAt && crosshair.alpha < 0.05) {
            lastPredictionAt = 0;
            setReady();
        }
    });

    setLoading();
    window.addEventListener('resize', positionPanel);

    return {
        setReady,
        updatePrediction,
    };
}
