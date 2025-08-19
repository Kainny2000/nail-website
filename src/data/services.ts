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
    name: 'Uñas soft gel',
    description: 'Aplicación de uñas soft gel con un acabado natural y duradero.',
    min_price: 40,
    icon: '/src/assets/icons/Nails.svg'
  }
];