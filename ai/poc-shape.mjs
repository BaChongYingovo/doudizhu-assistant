import ort from 'onnxruntime-node'
for (const n of ['landlord','landlord_up','landlord_down']) {
  const s = await ort.InferenceSession.create(`models/douzero_WP/${n}.onnx`)
  console.log(n, s.inputNames, s.inputMetadata ? JSON.stringify(s.inputMetadata) : '')
  console.log(' outputs', s.outputNames)
}
