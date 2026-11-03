import { buildLayout } from "./layout";

export default async function main(game) {
    const container = buildLayout(game.app);
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    // the aim sprite stays hidden (it would show up in the frames sent to YOLO); it's only used
    // to convert the prediction into screen coordinates, the visible crosshair lives in layout.js
    game.stage.aim.visible = false;

    worker.onmessage = ({ data }) => {
        const { type, x, y } = data;

        if (type === 'model-loaded') {
            container.setReady();
            return;
        }

        if (type === 'prediction') {
            console.log(`🎯 AI predicted at: (${x}, ${y})`);

            game.stage.aim.setPosition(data.x, data.y);
            const position = game.stage.aim.getGlobalPosition();

            container.updatePrediction({
                x: position.x,
                y: position.y,
                score: data.score,
            });

            game.handleClick({
                global: position,
            });

        }

    };

    setInterval(async () => {
        const canvas = game.app.renderer.extract.canvas(game.stage);
        const bitmap = await createImageBitmap(canvas);

        worker.postMessage({
            type: 'predict',
            image: bitmap,
        }, [bitmap]);

    }, 200); // every 200ms

    return container;
}
