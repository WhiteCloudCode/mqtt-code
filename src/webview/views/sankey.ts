import * as echarts from 'echarts';
import { SerialisedTopicNode } from '../../models/topic-node';
import { sankeyContainer } from '../dom';
import { state } from '../state';
import { computeAggregatedMessageCounts } from '../utils/tree-utils';

interface SankeyNode {
  name: string;
  value: number;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

function buildSankeyData(
  node: SerialisedTopicNode,
  data: SankeyNode[],
  links: SankeyLink[],
  parentName: string | null = null
) {
  const nodeCount =
    (node as SerialisedTopicNode & { aggregatedMessageCount?: number }).aggregatedMessageCount ??
    node.messageCount;

  if (nodeCount === 0) {
    return;
  }

  const currentName = node.fullTopic || 'Root';

  data.push({
    name: currentName,
    value: nodeCount,
  });

  if (parentName) {
    links.push({
      source: parentName,
      target: currentName,
      value: nodeCount,
    });
  }

  for (const childKey of Object.keys(node.children)) {
    buildSankeyData(node.children[childKey], data, links, currentName);
  }
}

export function renderSankeyChart(node: SerialisedTopicNode) {
  if (!state.sankeyChartInstance) {
    state.sankeyChartInstance = echarts.init(sankeyContainer);
  }

  computeAggregatedMessageCounts(node);

  const data: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  buildSankeyData(node, data, links);

  if (data.length <= 1) {
    state.sankeyChartInstance.clear();
    sankeyContainer.innerHTML =
      '<div class="empty-state-message">Not enough data to display flow.</div>';
    return;
  }

  const option = {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: '#252526',
      borderColor: '#454545',
      textStyle: { color: '#cccccc' },
      formatter: (params: {
        dataType: string;
        data: { name?: string; source?: string; target?: string };
        value: number;
      }) => {
        if (params.dataType === 'node') {
          return `${params.data.name}<br/>Messages: ${params.value}`;
        }
        return `${params.data.source} ➔ ${params.data.target}<br/>Messages: ${params.value}`;
      },
    },
    series: [
      {
        type: 'sankey',
        data: data,
        links: links,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'source', curveness: 0.5 },
        label: {
          color: '#cccccc',
          fontFamily: 'monospace',
          formatter: (params: {
            data: { name: string; source: string; target: string };
            value: number;
          }) => {
            const parts = params.data.name.split('/');
            return parts[parts.length - 1];
          },
        },
        nodeAlign: 'left',
        layoutIterations: 32,
      },
    ],
  };

  state.sankeyChartInstance.setOption(option, true);
}
