import React from 'react'
import { Box, Typography, Button } from '@mui/material'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center', mt: 10 }}>
          <Typography variant="h4" color="error" gutterBottom>Something went wrong</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            An unexpected error occurred. Please refresh the page.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>Refresh Page</Button>
        </Box>
      )
    }
    return this.props.children
  }
}
