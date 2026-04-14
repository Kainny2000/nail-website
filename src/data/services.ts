export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  category: string;
  isAddon?: boolean;
  basePrice?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export const categories: Category[] = [
  { id: 'nails', name: 'Uñas', description: 'Servicios principales de uñas' },
  { id: 'removal', name: 'Retirado', description: 'Servicios de remoción' },
  { id: 'pedicure', name: 'Pedicuras', description: 'Servicios de pedicura' },
];

export const services: Service[] = [
  // Uñas
  {
    id: 'soft-gel',
    name: 'Uñas Soft Gel',
    description: 'Uñas ligeras, naturales y resistentes con acabado brillante. El sistema de soft gel utiliza tips flexibles que se adhieren sin dañar tu uña, brindando comodidad y durabilidad de 2 a 3 semanas.',
    price: 55,
    icon: '/icons/Hard_nails.svg',
    category: 'nails',
  },
  {
    id: 'builder-rubber-gel',
    name: 'Nivelación con Rubber o Builder Gel',
    description: 'Refuerza y nivela la uña natural, corrigiendo imperfecciones para un acabado liso y resistente. El rubber o builder gel aporta flexibilidad y mayor durabilidad, ayudando a evitar quiebres.',
    price: 50,
    icon: '/icons/Hard_nails.svg',
    category: 'nails',
  },
  {
    id: 'polygel',
    name: 'Polygel',
    description: 'Sistema híbrido que combina la resistencia del acrílico con la ligereza del gel. Permite crear extensiones fuertes, ligeras y con acabado natural. Ideal para uñas duraderas, cómodas y con forma personalizada sin sensación pesada.',
    price: 60,
    icon: '/icons/Hard_nails.svg',
    category: 'nails',
  },

  // Retirado
  {
    id: 'removal-koki',
    name: 'Remoción de Diseño (Trabajo Propio)',
    description: 'Retiro seguro del diseño anterior realizado por Bare Form, cuidando la estructura de la uña para mantener su salud. Preparación ideal para un nuevo servicio sin daños ni desgaste innecesario.',
    price: 0,
    icon: '/icons/File_nails.svg',
    category: 'removal',
  },
  {
    id: 'removal-external',
    name: 'Remoción de Diseño (Trabajo Externo)',
    description: 'Retiro cuidadoso de producto realizado por otro salón, evaluando la estructura de la uña para evitar daños. Preparación segura para aplicar un nuevo servicio con mejor adherencia y acabado.',
    price: 5,
    icon: '/icons/File_nails.svg',
    category: 'removal',
  },
  {
    id: 'removal-only',
    name: 'Retiro de Producto',
    description: 'Eliminación segura del gel, acrílico o polygel sin aplicar nuevo servicio. Se realiza cuidadosamente para proteger la uña natural y mantener su salud. Ideal si deseas descansar tus uñas o retirar el producto actual.',
    price: 30,
    icon: '/icons/File_nails.svg',
    category: 'removal',
  },
  // Pedicura
  {
    id: 'pedicura-estetica',
    name: 'Pedicura Estética',
    description: 'Limpieza, corte y cuidado básico de uñas y cutícula, con exfoliación e hidratación. Ideal para mantener tus pies limpios, suaves y con apariencia saludable.',
    price: 45,
    icon: '/icons/Pedicure.svg',
    category: 'pedicure',
  },
  {
    id: 'pedicura-spa',
    name: 'Pedicura Spa',
    description: 'Tratamiento completo que combina limpieza, exfoliación e hidratación profunda para relajar y revitalizar tus pies.',
    price: 50,
    icon: '/icons/Pedicure.svg',
    category: 'pedicure',
  },

];