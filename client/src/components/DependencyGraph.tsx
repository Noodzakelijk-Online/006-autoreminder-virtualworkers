import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  cardName: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'blocked' | 'ready_for_review';
  blockedBy: string[];
  blocks: string[];
}

interface DependencyGraphProps {
  tasks: Task[];
  onRefresh?: () => void;
}

interface Node {
  id: string;
  title: string;
  status: string;
  x: number;
  y: number;
  level: number;
}

interface Edge {
  from: string;
  to: string;
}

export default function DependencyGraph({ tasks, onRefresh }: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Build graph layout
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    
    // Calculate levels based on dependencies
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    
    const calculateLevel = (taskId: string, currentLevel: number): number => {
      if (visited.has(taskId)) return levels.get(taskId) || 0;
      visited.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (!task) return currentLevel;
      
      let maxBlockerLevel = -1;
      for (const blockerId of task.blockedBy) {
        const blockerLevel = calculateLevel(blockerId, currentLevel);
        maxBlockerLevel = Math.max(maxBlockerLevel, blockerLevel);
      }
      
      const level = maxBlockerLevel + 1;
      levels.set(taskId, level);
      return level;
    };
    
    // Calculate levels for all tasks
    tasks.forEach(task => calculateLevel(task.id, 0));
    
    // Group tasks by level
    const levelGroups = new Map<number, Task[]>();
    tasks.forEach(task => {
      const level = levels.get(task.id) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(task);
    });
    
    // Position nodes
    const nodeWidth = 180;
    const nodeHeight = 80;
    const levelSpacing = 250;
    const nodeSpacing = 120;
    
    levelGroups.forEach((levelTasks, level) => {
      const startY = -(levelTasks.length - 1) * nodeSpacing / 2;
      levelTasks.forEach((task, index) => {
        nodeMap.set(task.id, {
          id: task.id,
          title: task.title.length > 25 ? task.title.substring(0, 25) + '...' : task.title,
          status: task.status,
          x: level * levelSpacing + 100,
          y: startY + index * nodeSpacing + 300,
          level,
        });
      });
    });
    
    // Create edges
    tasks.forEach(task => {
      task.blockedBy.forEach(blockerId => {
        if (nodeMap.has(blockerId)) {
          edgeList.push({ from: blockerId, to: task.id });
        }
      });
    });
    
    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [tasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: '#dcfce7', border: '#22c55e', text: '#166534' };
      case 'in_progress': return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
      case 'blocked': return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' };
      case 'ready_for_review': return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
      default: return { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' };
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.4));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5 text-indigo-500" />
            Task Dependencies
          </CardTitle>
          <CardDescription>Visual representation of task relationships</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Maximize2 className="h-12 w-12 mb-4 opacity-50" />
            <p>No tasks with dependencies to display</p>
            <p className="text-sm">Tasks will appear here when they have blockers or are blocking other tasks</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Maximize2 className="h-5 w-5 text-indigo-500" />
              Task Dependencies
            </CardTitle>
            <CardDescription>
              {nodes.length} tasks • {edges.length} dependencies
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            {onRefresh && (
              <Button variant="outline" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dcfce7', border: '2px solid #22c55e' }} />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dbeafe', border: '2px solid #3b82f6' }} />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fee2e2', border: '2px solid #ef4444' }} />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fef3c7', border: '2px solid #f59e0b' }} />
            <span>Ready for Review</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f3f4f6', border: '2px solid #9ca3af' }} />
            <span>Assigned</span>
          </div>
        </div>

        {/* Graph */}
        <div 
          className="border rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900"
          style={{ height: '500px', cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
              </marker>
            </defs>
            
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {edges.map((edge, i) => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                
                const startX = fromNode.x + 90;
                const startY = fromNode.y;
                const endX = toNode.x - 90;
                const endY = toNode.y;
                
                // Bezier curve control points
                const midX = (startX + endX) / 2;
                
                return (
                  <path
                    key={i}
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                    fill="none"
                    stroke={hoveredNode === edge.from || hoveredNode === edge.to ? '#6366f1' : '#9ca3af'}
                    strokeWidth={hoveredNode === edge.from || hoveredNode === edge.to ? 3 : 2}
                    markerEnd="url(#arrowhead)"
                    style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                  />
                );
              })}
              
              {/* Nodes */}
              {nodes.map(node => {
                const colors = getStatusColor(node.status);
                const isHovered = hoveredNode === node.id;
                
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x - 90}, ${node.y - 30})`}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width="180"
                      height="60"
                      rx="8"
                      fill={colors.bg}
                      stroke={isHovered ? '#6366f1' : colors.border}
                      strokeWidth={isHovered ? 3 : 2}
                      style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                    />
                    <text
                      x="90"
                      y="25"
                      textAnchor="middle"
                      fill={colors.text}
                      fontSize="12"
                      fontWeight="600"
                    >
                      {node.title}
                    </text>
                    <text
                      x="90"
                      y="45"
                      textAnchor="middle"
                      fill={colors.text}
                      fontSize="10"
                      opacity="0.7"
                    >
                      {node.status.replace('_', ' ').toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Drag to pan • Use zoom controls to adjust view • Arrows show dependency direction (blocked by → blocks)
        </p>
      </CardContent>
    </Card>
  );
}
