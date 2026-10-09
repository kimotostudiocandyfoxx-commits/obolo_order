## Seed-VC parts → ONNX Runtime (CPU)

| part | ONNX | size | PyTorch | ONNX Runtime | agreement |
|---|---|---|---|---|---|
| bigvgan | ❌ SymbolicValueError: Unsupported: ONNX export of convolution for kernel of unknown shape.  [Caused by the value '709 defined in (%709 : Float | | | | |
| campplus | ✅ | 28 MB | 135 ms | 84 ms | 50 dB |
| whisper-encoder | ✅ | 353 MB | 2181 ms | 2036 ms | 96 dB |
| rmvpe | ✅ | 362 MB | 670 ms | 456 ms | 123 dB |

- DiT (flow matching, the voice-changing core): not attempted — KV cache + its own sampling loop; needs a hand-written export.

## Seed-VC parts → ONNX Runtime (CPU)

| part | ONNX | size | PyTorch | ONNX Runtime | agreement |
|---|---|---|---|---|---|
| bigvgan | ❌ SymbolicValueError: Unsupported: ONNX export of convolution for kernel of unknown shape.  [Caused by the value '709 defined in (%709 : Float | | | | |
| campplus | ✅ | 28 MB | 134 ms | 66 ms | 50 dB |
| whisper-encoder | ✅ | 353 MB | 1386 ms | 1420 ms | 98 dB |
| rmvpe | ✅ | 362 MB | 512 ms | 320 ms | 124 dB |

- DiT (flow matching, the voice-changing core): not attempted — KV cache + its own sampling loop; needs a hand-written export.

