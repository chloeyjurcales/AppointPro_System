import { ImageSourcePropType } from 'react-native';

// Logo shown next to each department (keyed by the department code).
export const DEPARTMENT_LOGOS: Record<string, ImageSourcePropType> = {
  CCS: require('../assets/departments/ccs.png'),
  CTE: require('../assets/departments/cte.png'),
  PSYCH: require('../assets/departments/psych.png'),
  CBE: require('../assets/departments/cbe.png'),
  CCJE: require('../assets/departments/ccje.png'),
};