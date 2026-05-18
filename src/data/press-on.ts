export interface PressOnPackage {
  id: string;
  name: string;
  description: string;
  basePrice?: number;
  imageUrl?: string;
}

export const pressOnPackages: PressOnPackage[] = [
  {
    id: 'french-tip',
    name: 'French Tip',
    description: 'Clásico y elegante diseño con punta blanca.',
  },
  {
    id: 'marmol',
    name: 'Mármol',
    description: 'Elegante efecto mármol en tonos neutros.',
  },
  {
    id: 'glitter',
    name: 'Glitter',
    description: 'Brillo y glamour con glitter iridiscente.',
  },
  {
    id: 'floral',
    name: 'Floral',
    description: 'Decoración floral delicada y femenina.',
  },
  {
    id: 'geometrico',
    name: 'Geométrico',
    description: 'Líneas y formas geométricas modernas.',
  },
  {
    id: 'baby-boomer',
    name: 'Baby Boomer',
    description: 'Degradado suave de blanco a nude natural.',
  },
];
