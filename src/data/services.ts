export interface Service {
  id: string;
  name: string;
  description: string;
  min_price: number;
  icon: string;
}

export const services: Service[] = [
  {
    id: 'soft-get',
    name: 'Uñas Soft Gel',
    description: 'Aplicación de uñas soft gel con un acabado natural y duradero.',
    min_price: 40,
    icon: '/icons/Soft_nails.svg'
  },
  {
    id: 'builder-gel',
    name: 'Uñas Builder Gel',
    description: 'Aplicación de uñas con builder gel para mayor resistencia y durabilidad.',
    min_price: 40,
    icon: '/icons/Hard_nails.svg'
  }
];