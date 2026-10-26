// User-approved component names, material recommendations, and pack configuration.
export const PART_DATA = [
  {
    id: 'p1',
    name: '上盖、底座、塑料外壳',
    number: '①',
    recommendation: 'BT-CS 阻燃系列（PC/ABS），户外件加耐候',
    kind: 'plastic',
  },
  {
    id: 'p2',
    name: '电芯支架、铝壳内绝缘支架',
    number: '②',
    recommendation: 'BT-PC 阻燃、增强系列',
    kind: 'plastic',
  },
  {
    id: 'p3',
    name: 'BMS支架',
    number: '③',
    recommendation: 'BT-PA66 阻燃增强系列',
    kind: 'plastic',
  },
  {
    id: 'p4',
    name: '放电口、换电连接器座',
    number: '④',
    recommendation: 'BT-PA66 阻燃增强系列',
    kind: 'plastic',
  },
  { id: 'shell', name: '铝型材外壳', number: null, recommendation: null, kind: 'metal' },
  { id: 'cells', name: '电芯组', number: null, recommendation: null, kind: 'cells' },
  { id: 'pcb', name: 'BMS电路板', number: null, recommendation: null, kind: 'pcb' },
  { id: 'busbar', name: '汇流排', number: null, recommendation: null, kind: 'metal' },
  { id: 'contacts', name: '金属插片', number: null, recommendation: null, kind: 'metal' },
  { id: 'fasteners', name: '金属紧固件', number: null, recommendation: null, kind: 'metal' },
];

export const PACK_CONFIG = [
  { label: '串并联配置', value: '13S5P' },
  { label: '标称电压', value: '48.1V' },
  { label: '容量', value: '25Ah' },
];
