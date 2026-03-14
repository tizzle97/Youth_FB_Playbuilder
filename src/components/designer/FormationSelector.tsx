import React, { useEffect, useState } from 'react';
import { Layout } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as fabric from 'fabric';
import type { Canvas, Object as FabricObject, Line } from 'fabric/fabric-impl';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Formation {
  id: string;
  name: string;
  type: 'offense' | 'defense';
  template: string;
}

interface FormationSelectorProps {
  playType: 'offense' | 'defense';
  selectedFormation: string | null;
  onFormationSelect: (formationId: string) => void;
  canvas: Canvas | null;
}

export function FormationSelector({
  playType,
  selectedFormation,
  onFormationSelect,
  canvas
}: FormationSelectorProps) {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFormations = async () => {
      try {
        setLoading(true);
        setError(null);

        // Create default formations if they don't exist
        const defaultFormations = [
          {
            name: 'Shotgun',
            type: 'offense',
            template: JSON.stringify({
              objects: [
                { type: 'circle', position: { x: 0.5, y: 0.3 }, label: 'QB' },
                { type: 'circle', position: { x: 0.3, y: 0.2 }, label: 'RB' },
                { type: 'rect', position: { x: 0.5, y: 0.1 }, label: 'C' },
                { type: 'rect', position: { x: 0.4, y: 0.1 }, label: 'G' },
                { type: 'rect', position: { x: 0.6, y: 0.1 }, label: 'G' },
                { type: 'rect', position: { x: 0.3, y: 0.1 }, label: 'T' },
                { type: 'rect', position: { x: 0.7, y: 0.1 }, label: 'T' },
                { type: 'circle', position: { x: 0.2, y: 0.1 }, label: 'TE' },
                { type: 'circle', position: { x: 0.8, y: 0.1 }, label: 'WR' },
                { type: 'circle', position: { x: 0.1, y: 0.1 }, label: 'WR' },
                { type: 'circle', position: { x: 0.9, y: 0.1 }, label: 'WR' }
              ]
            })
          },
          {
            name: 'I-Formation',
            type: 'offense',
            template: JSON.stringify({
              objects: [
                { type: 'circle', position: { x: 0.5, y: 0.2 }, label: 'QB' },
                { type: 'circle', position: { x: 0.5, y: 0.3 }, label: 'FB' },
                { type: 'circle', position: { x: 0.5, y: 0.4 }, label: 'RB' },
                { type: 'rect', position: { x: 0.5, y: 0.1 }, label: 'C' },
                { type: 'rect', position: { x: 0.4, y: 0.1 }, label: 'G' },
                { type: 'rect', position: { x: 0.6, y: 0.1 }, label: 'G' },
                { type: 'rect', position: { x: 0.3, y: 0.1 }, label: 'T' },
                { type: 'rect', position: { x: 0.7, y: 0.1 }, label: 'T' },
                { type: 'circle', position: { x: 0.2, y: 0.1 }, label: 'TE' },
                { type: 'circle', position: { x: 0.8, y: 0.1 }, label: 'WR' },
                { type: 'circle', position: { x: 0.1, y: 0.1 }, label: 'WR' }
              ]
            })
          },
          {
            name: '4-3 Defense',
            type: 'defense',
            template: JSON.stringify({
              objects: [
                { type: 'rect', position: { x: 0.4, y: 0.1 }, label: 'DT' },
                { type: 'rect', position: { x: 0.6, y: 0.1 }, label: 'DT' },
                { type: 'rect', position: { x: 0.2, y: 0.1 }, label: 'DE' },
                { type: 'rect', position: { x: 0.8, y: 0.1 }, label: 'DE' },
                { type: 'circle', position: { x: 0.3, y: 0.3 }, label: 'LB' },
                { type: 'circle', position: { x: 0.5, y: 0.3 }, label: 'MLB' },
                { type: 'circle', position: { x: 0.7, y: 0.3 }, label: 'LB' },
                { type: 'circle', position: { x: 0.2, y: 0.5 }, label: 'CB' },
                { type: 'circle', position: { x: 0.8, y: 0.5 }, label: 'CB' },
                { type: 'circle', position: { x: 0.4, y: 0.7 }, label: 'S' },
                { type: 'circle', position: { x: 0.6, y: 0.7 }, label: 'S' }
              ]
            })
          },
          {
            name: '3-4 Defense',
            type: 'defense',
            template: JSON.stringify({
              objects: [
                { type: 'rect', position: { x: 0.5, y: 0.1 }, label: 'NT' },
                { type: 'rect', position: { x: 0.3, y: 0.1 }, label: 'DE' },
                { type: 'rect', position: { x: 0.7, y: 0.1 }, label: 'DE' },
                { type: 'circle', position: { x: 0.2, y: 0.3 }, label: 'OLB' },
                { type: 'circle', position: { x: 0.4, y: 0.3 }, label: 'ILB' },
                { type: 'circle', position: { x: 0.6, y: 0.3 }, label: 'ILB' },
                { type: 'circle', position: { x: 0.8, y: 0.3 }, label: 'OLB' },
                { type: 'circle', position: { x: 0.2, y: 0.5 }, label: 'CB' },
                { type: 'circle', position: { x: 0.8, y: 0.5 }, label: 'CB' },
                { type: 'circle', position: { x: 0.4, y: 0.7 }, label: 'S' },
                { type: 'circle', position: { x: 0.6, y: 0.7 }, label: 'S' }
              ]
            })
          }
        ];

        // Check if formations exist
        const { data: existingFormations } = await supabase
          .from('formations')
          .select('*')
          .eq('type', playType);

        if (!existingFormations || existingFormations.length === 0) {
          // Insert default formations
          const formationsToInsert = defaultFormations
            .filter(f => f.type === playType)
            .map(f => ({
              name: f.name,
              type: f.type,
              template: f.template,
              is_system: true
            }));

          if (formationsToInsert.length > 0) {
            await supabase.from('formations').insert(formationsToInsert);
          }
        }

        // Fetch formations
        const { data, error: fetchError } = await supabase
          .from('formations')
          .select('*')
          .eq('type', playType)
          .order('name');

        if (fetchError) throw fetchError;
        setFormations(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load formations');
        console.error('Error loading formations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFormations();
  }, [playType]);

  const applyFormation = (formationId: string) => {
    if (!canvas) return;
    
    onFormationSelect(formationId);
    
    const formation = formations.find(f => f.id === formationId);
    if (!formation) return;
    
    try {
      // Clear existing player objects
      const playerObjects = canvas.getObjects().filter((obj: FabricObject & { name?: string }) => 
        obj.name !== 'field-line' && 
        !(obj.type === 'path')
      );
      playerObjects.forEach((obj: FabricObject) => canvas.remove(obj));
      
      // Parse formation template
      const template = JSON.parse(formation.template);
      
      if (template.objects && Array.isArray(template.objects)) {
        // Find field dimensions
        const width = canvas.width!;
        const height = canvas.height!;
        const leftSidelineX = width * 0.05;
        const rightSidelineX = width * 0.95;
        
        // Find LOS
        const losLine = canvas.getObjects().find((obj) => {
          const lineObj = obj as FabricObject & { name?: string; stroke?: string };
          return lineObj.name === 'field-line' && 
                 lineObj.type === 'line' &&
                 lineObj.stroke === '#60A5FA';
        }) as Line;
        
        const losY = losLine ? losLine.y1! : height * 0.67;
        
        // Add each player from the template
        template.objects.forEach((obj: any) => {
          const x = leftSidelineX + (rightSidelineX - leftSidelineX) * obj.position.x;
          const y = height * obj.position.y;
          
          let playerObj;
          
          if (obj.type === 'circle') {
            // Create circle for skill positions
            const circle = new fabric.Circle({
              left: x,
              top: y,
              radius: 36, // Increased size (3x)
              fill: '#3B82F6',
              stroke: '#3B82F6',
              originX: 'center',
              originY: 'center',
            });
            
            const label = new fabric.Text(obj.label || '', {
              fontSize: 30, // Increased size (3x)
              fill: '#FFFFFF',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '600',
              originX: 'center',
              originY: 'center',
            });
            
            playerObj = new fabric.Group([circle, label], {
              left: x,
              top: y,
              originX: 'center',
              originY: 'center',
            });
          } else if (obj.type === 'rect') {
            // Create rectangle for linemen
            const rect = new fabric.Rect({
              left: x,
              top: y,
              width: 72, // Increased size (3x)
              height: 72, // Increased size (3x)
              fill: '#000000',
              stroke: '#000000',
              originX: 'center',
              originY: 'center',
            });
            
            const label = new fabric.Text(obj.label || '', {
              fontSize: 30, // Increased size (3x)
              fill: '#FFFFFF',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '600',
              originX: 'center',
              originY: 'center',
            });
            
            playerObj = new fabric.Group([rect, label], {
              left: x,
              top: y,
              originX: 'center',
              originY: 'center',
            });
          }
          
          if (playerObj) {
            canvas.add(playerObj);
          }
        });
        
        canvas.renderAll();
      }
    } catch (err) {
      console.error('Error applying formation:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-board rounded-lg border border-chalk/10 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-chalk/10 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-chalk/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-board rounded-lg border border-chalk/10 p-4">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-board rounded-lg border border-chalk/10 p-4">
      <h2 className="text-lg font-semibold text-chalk flex items-center gap-2 mb-4">
        <Layout className="h-5 w-5 text-primary" />
        Formation
      </h2>

      <div className="grid grid-cols-2 gap-4">
        {formations.map((formation) => (
          <button
            key={formation.id}
            onClick={() => applyFormation(formation.id)}
            className={`p-4 rounded-lg border ${
              selectedFormation === formation.id
                ? 'border-primary bg-primary/10'
                : 'border-chalk/20 hover:border-chalk/40'
            } transition-colors`}
          >
            <h3 className="text-chalk font-medium">{formation.name}</h3>
          </button>
        ))}
      </div>
    </div>
  );
}