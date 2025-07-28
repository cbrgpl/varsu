// var(--var-name) -> --var-name -> schema['--var-name']
// [it is formule if calc is present] calc( var(--var-name) * N ) ->  var(--var-name) * N -> schema['--var-name'] * N -> applyUnit(removeUnit(schema['--var-name']) * N)

export default {
  '--variable-1': '10px',
  '--button-width': '20px',
  '--h1-fs': '32px',
  '--bg-border-primary': '#dcdde4',

  // Variable contains another variable
  '--content-text-secondary': 'var(--bg-border-primary)',

  // rgb -> hex
  '--content-text-primary': 'rgb(155, 155, 123)',

  // rgba -> hex
  '--form-element-border': 'rgba(34, 37, 52, 0.1)',

  // Complex variable(not formula)
  '--t1-fs': '16px',
  '--t1-lh': '16px',
  '--font-default': '"Halvar Mittelschrift", sans-serif',
  '--t1': 'var(--t1-fs)/var(--t1-lh) var(--font-default)',

  // formuls
  '--x0': '0',
  '--x1': '4px',
  '--x0_25': 'calc(var(--x1) * 0.25)',
  '--x5': 'calc(var(--x1) * 5)',
};
