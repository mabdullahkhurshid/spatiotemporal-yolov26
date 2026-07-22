"""
Fire & Smoke Detection Training Pipeline
---------------------------------------

This script implements a lightweight 3D CNN + Transformer-based model
for fire/smoke detection on video clips, designed to be exported to
TensorFlow.js for browser inference.

High-level features:
- 3D convolutions for spatio-temporal features
- Residual blocks
- Spatial attention
- Temporal transformer encoder + positional encoding
- Positional gating unit (PGU)
- Multi-head outputs: fire, smoke, binary presence

Usage (example):
    python train_fire_smoke_model.py \\
        --data_root /path/to/datasets \\
        --epochs 20 \\
        --batch_size 8

This script is self-contained and does not depend on the Node app.
Integrate the exported model with TensorFlow.js using the separate
conversion script.
"""

import argparse
import os
from dataclasses import dataclass
from typing import Tuple

import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model


@dataclass
class TrainingConfig:
    time_steps: int = 16
    height: int = 112
    width: int = 112
    channels: int = 3
    d_model: int = 128
    batch_size: int = 8
    epochs: int = 10
    learning_rate: float = 1e-4
    train_split: float = 0.8


def residual_block_3d(x, filters, kernel_size=(3, 3, 3), stride=(1, 1, 1)):
    shortcut = x
    x = layers.Conv3D(filters, kernel_size, strides=stride, padding="same", use_bias=False)(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = layers.Conv3D(filters, kernel_size, strides=(1, 1, 1), padding="same", use_bias=False)(x)
    x = layers.BatchNormalization()(x)

    if shortcut.shape[-1] != filters or stride != (1, 1, 1):
        shortcut = layers.Conv3D(filters, (1, 1, 1), strides=stride, padding="same", use_bias=False)(shortcut)
        shortcut = layers.BatchNormalization()(shortcut)

    x = layers.Add()([x, shortcut])
    x = layers.ReLU()(x)
    return x


def spatial_attention_3d(x):
    # x: (B, T, H, W, C)
    max_pool = tf.reduce_max(x, axis=-1, keepdims=True)
    avg_pool = tf.reduce_mean(x, axis=-1, keepdims=True)
    concat = tf.concat([max_pool, avg_pool], axis=-1)
    attn = layers.Conv3D(1, (1, 1, 1), padding="same", activation="sigmoid")(concat)
    return x * attn


def temporal_attention(x):
    # x: (B, T, D) sequence for transformer output
    attn_scores = layers.Dense(1)(x)  # (B, T, 1)
    attn_weights = tf.nn.softmax(attn_scores, axis=1)
    return tf.reduce_sum(x * attn_weights, axis=1)  # (B, D)


def positional_encoding(T: int, d_model: int) -> tf.Tensor:
    pos = tf.range(T, dtype=tf.float32)[:, tf.newaxis]  # (T, 1)
    i = tf.range(d_model, dtype=tf.float32)[tf.newaxis, :]  # (1, D)
    angle_rates = 1 / tf.pow(10000.0, (2 * (i // 2)) / tf.cast(d_model, tf.float32))
    angle_rads = pos * angle_rates
    sines = tf.sin(angle_rads[:, 0::2])
    cosines = tf.cos(angle_rads[:, 1::2])
    pe = tf.concat([sines, cosines], axis=-1)
    return tf.cast(pe, tf.float32)  # (T, D)


def positional_gating_unit(x):
    # x: (B, T, D)
    gate = tf.nn.sigmoid(layers.Dense(x.shape[-1])(x))
    return x * gate


def build_fire_smoke_model(cfg: TrainingConfig) -> Model:
    T = cfg.time_steps
    H = cfg.height
    W = cfg.width
    C = cfg.channels
    d_model = cfg.d_model

    inputs = layers.Input(shape=(T, H, W, C))

    x = layers.Conv3D(32, (3, 3, 3), strides=(1, 2, 2), padding="same", use_bias=False)(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)

    x = residual_block_3d(x, 32)
    x = residual_block_3d(x, 64, stride=(1, 2, 2))
    x = residual_block_3d(x, 64)

    x = spatial_attention_3d(x)

    # (B, T, H, W, C) -> (B, T, D)
    shape = x.shape
    T_dim = int(shape[1])
    H_dim = int(shape[2])
    W_dim = int(shape[3])
    C_dim = int(shape[4])
    x = layers.Reshape((T_dim, H_dim * W_dim * C_dim))(x)
    x = layers.Dense(d_model)(x)

    pe = positional_encoding(T_dim, d_model)
    x = x + pe
    x = positional_gating_unit(x)

    attn_output = layers.MultiHeadAttention(num_heads=4, key_dim=d_model)(x, x)
    x = layers.LayerNormalization(epsilon=1e-6)(x + attn_output)
    ffn = layers.Dense(d_model * 4, activation="relu")(x)
    ffn = layers.Dense(d_model)(ffn)
    x = layers.LayerNormalization(epsilon=1e-6)(x + ffn)

    clip_feat = temporal_attention(x)

    shared = layers.Dense(128, activation="relu")(clip_feat)
    fire_conf = layers.Dense(1, activation="sigmoid", name="fire_conf")(shared)
    smoke_conf = layers.Dense(1, activation="sigmoid", name="smoke_conf")(shared)
    binary = layers.Dense(1, activation="sigmoid", name="binary")(shared)

    model = Model(inputs, [fire_conf, smoke_conf, binary], name="FireSmoke3DNet")
    return model


def build_dummy_dataset(cfg: TrainingConfig, num_samples: int = 128) -> Tuple[tf.data.Dataset, tf.data.Dataset]:
    """
    Placeholder dataset generator.

    Replace this with real video loading using tf.data from your public datasets.
    """
    T, H, W, C = cfg.time_steps, cfg.height, cfg.width, cfg.channels
    X = np.random.rand(num_samples, T, H, W, C).astype("float32")
    y_fire = np.random.randint(0, 2, size=(num_samples, 1)).astype("float32")
    y_smoke = np.random.randint(0, 2, size=(num_samples, 1)).astype("float32")
    y_binary = np.maximum(y_fire, y_smoke)

    ds = tf.data.Dataset.from_tensor_slices((X, {"fire_conf": y_fire, "smoke_conf": y_smoke, "binary": y_binary}))
    ds = ds.shuffle(256).batch(cfg.batch_size).prefetch(tf.data.AUTOTUNE)

    train_size = int(num_samples * cfg.train_split)
    train_ds = ds.take(train_size // cfg.batch_size)
    val_ds = ds.skip(train_size // cfg.batch_size)
    return train_ds, val_ds


def train_and_export(cfg: TrainingConfig, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    strategy = tf.distribute.get_strategy()

    with strategy.scope():
        model = build_fire_smoke_model(cfg)
        losses = {
            "fire_conf": "binary_crossentropy",
            "smoke_conf": "binary_crossentropy",
            "binary": "binary_crossentropy",
        }
        loss_weights = {
            "fire_conf": 1.0,
            "smoke_conf": 1.0,
            "binary": 0.5,
        }
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=cfg.learning_rate),
            loss=losses,
            loss_weights=loss_weights,
            metrics={"binary": ["accuracy"]},
        )

    train_ds, val_ds = build_dummy_dataset(cfg)

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=os.path.join(output_dir, "best_model.keras"),
            monitor="val_loss",
            save_best_only=True,
        ),
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
    ]

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=cfg.epochs,
        callbacks=callbacks,
    )

    # Final export for conversion
    saved_model_path = os.path.join(output_dir, "saved_model")
    model.export(saved_model_path)
    print(f"SavedModel exported to: {saved_model_path}")


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description="Train fire/smoke 3D CNN + Transformer model")
    parser.add_argument("--time_steps", type=int, default=16)
    parser.add_argument("--height", type=int, default=112)
    parser.add_argument("--width", type=int, default=112)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--learning_rate", type=float, default=1e-4)
    parser.add_argument("--output_dir", type=str, default="./ml_output")

    args = parser.parse_args()
    return TrainingConfig(
      time_steps=args.time_steps,
      height=args.height,
      width=args.width,
      batch_size=args.batch_size,
      epochs=args.epochs,
      learning_rate=args.learning_rate,
    ), args.output_dir


if __name__ == "__main__":
    cfg, out_dir = parse_args()
    train_and_export(cfg, out_dir)

