import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#9c27b0', light: '#ba68c8', dark: '#7b1fa2' },
    secondary: { main: '#e91e63', light: '#f06292', dark: '#c2185b' },
    success:   { main: '#4caf50', light: '#81c784', dark: '#388e3c' },
    warning:   { main: '#ff9800', light: '#ffb74d', dark: '#f57c00' },
    info:      { main: '#00bcd4', light: '#4dd0e1', dark: '#0097a7' },
    error:     { main: '#f44336', light: '#e57373', dark: '#d32f2f' },
    background: { default: '#eeeeee', paper: '#ffffff' },
    text: { primary: '#3c4858', secondary: '#999999' },
  },
  typography: {
    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    h4: { fontWeight: 700, color: '#3c4858' },
    h5: { fontWeight: 700, color: '#3c4858' },
    h6: { fontWeight: 700, color: '#3c4858' },
    subtitle1: { color: '#999999' },
    body2: { color: '#999999' },
  },
  shape: { borderRadius: 6 },
  shadows: [
    'none',
    '0 2px 4px 0 rgba(0,0,0,.14)',
    '0 3px 1px -2px rgba(0,0,0,.2),0 2px 2px 0 rgba(0,0,0,.14),0 1px 5px 0 rgba(0,0,0,.12)',
    '0 1px 8px 0 rgba(0,0,0,.2),0 3px 3px -2px rgba(0,0,0,.14),0 3px 4px 0 rgba(0,0,0,.12)',
    '0 2px 4px -1px rgba(0,0,0,.2),0 4px 5px 0 rgba(0,0,0,.14),0 1px 10px 0 rgba(0,0,0,.12)',
    '0 10px 30px -12px rgba(0,0,0,.42),0 4px 25px 0 rgba(0,0,0,.12),0 8px 10px -5px rgba(0,0,0,.2)',
    '0 12px 20px -10px rgba(76,175,80,.28),0 4px 20px 0 rgba(0,0,0,.12),0 7px 8px -5px rgba(76,175,80,.2)',
    '0 12px 20px -10px rgba(0,188,212,.28),0 4px 20px 0 rgba(0,0,0,.12),0 7px 8px -5px rgba(0,188,212,.2)',
    '0 12px 20px -10px rgba(255,152,0,.28),0 4px 20px 0 rgba(0,0,0,.12),0 7px 8px -5px rgba(255,152,0,.2)',
    '0 12px 20px -10px rgba(233,30,99,.28),0 4px 20px 0 rgba(0,0,0,.12),0 7px 8px -5px rgba(233,30,99,.2)',
    '0 12px 20px -10px rgba(156,39,176,.28),0 4px 20px 0 rgba(0,0,0,.12),0 7px 8px -5px rgba(156,39,176,.2)',
    '0 12px 20px -10px rgba(244,67,54,.28),0 4px 20px 0 rgba(0,0,0,.12),0 7px 8px -5px rgba(244,67,54,.2)',
    ...Array(13).fill('0 4px 20px 0 rgba(0,0,0,.14),0 7px 10px -5px rgba(0,0,0,.1)'),
  ],
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: '0 1px 4px 0 rgba(0,0,0,.14)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, borderRadius: 4 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: { '& th': { fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: '#9a9a9a', letterSpacing: '0.05em' } },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500, fontSize: '0.7rem' } },
    },
  },
})

export default theme
