import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

/**
 * Enregistrement des modules Chart.js, à importer par TOUT écran qui affiche un
 * graphique.
 *
 * Chart.js n'embarque rien par défaut : un écran qui dessine sans avoir
 * enregistré l'échelle et les éléments plante à l'exécution. L'enregistrement
 * vivait jusqu'ici dans DashboardPage et PlatformPage, donc un accès direct à
 * une autre page graphique (lien partagé, rechargement, navigation profonde)
 * pouvait tomber sur des modules jamais chargés. L'opération est idempotente :
 * l'importer en plus des pages existantes ne change rien pour elles.
 */
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Filler);

export { ChartJS };
