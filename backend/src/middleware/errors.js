export function notFound(_req, res) {
  res.status(404).json({ message: 'The requested resource was not found.' })
}

export function errorHandler(error, _req, res, _next) {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: error.message })
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'This record already exists.' })
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid resource identifier.' })
  }
  console.error(error)
  return res.status(error.status || 500).json({
    message: error.status ? error.message : 'Something went wrong on our end.',
  })
}
