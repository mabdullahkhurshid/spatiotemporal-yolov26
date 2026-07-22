TensorFlow.js Conversion Guide
==============================

After training the fire/smoke model with `train_fire_smoke_model.py`,
you will have a SavedModel under a directory like:

- `ml_output/saved_model`

To convert this model for use in the React frontend with TensorFlow.js:

1. Install the TensorFlow.js converter (once per Python environment):

```bash
pip install tensorflowjs
```

2. Run the converter, pointing to the SavedModel directory:

```bash
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --quantization_bytes=2 \
  ./ml_output/saved_model \
  ./frontend/public/models/fire_smoke_tfjs
```

This will create:

- `model.json`
- One or more `group*-shard*.bin` weight files

3. In the frontend, you can then load the model with:

```js
import * as tf from '@tensorflow/tfjs';

await tf.setBackend('webgl');
await tf.ready();

const model = await tf.loadGraphModel('/models/fire_smoke_tfjs/model.json');
```

4. Make sure the `frontend/public/models/fire_smoke_tfjs` directory
is committed/deployed with your app so that the browser can fetch
the model assets.

