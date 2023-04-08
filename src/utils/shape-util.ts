/**
 * The MIT License (MIT)
 *
 * Igor Zinken 2023 - https://www.igorski.nl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import type { Rectangle } from "zcanvas";
import type { Shape } from "@/definitions/document";

export const shapeToRectangle = ( shape: Shape ): Rectangle => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;

    shape.forEach(({ x, y }) => {
        minX = Math.min( minX, x );
        maxX = Math.max( maxX, x );
        minY = Math.min( minY, y );
        maxY = Math.max( maxY, y );
    });
    return {
        left   : minX,
        top    : minY,
        width  : maxX - minX,
        height : maxY - minY
    };
};

export const rectangleToShape = ( width: number, height: number, x = 0, y = 0 ): Shape => [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
    { x, y }
];

export const isShapeRectangular = ( shape: Shape ): boolean => {
    if ( shape.length !== 5 ) {
        return false;
    }
    if ( shape[ 1 ].x !== shape[ 2 ].x ||
         shape[ 2 ].y !== shape[ 3 ].y ) {
         return false;
    }
    return isShapeClosed( shape );
};

export const isShapeClosed = ( shape: Shape ): boolean => {
    // smallest shape is four point polygon
    if ( !shape || shape.length < 3 ) {
        return false;
    }
    const firstPoint = shape[ 0 ];
    const lastPoint  = shape[ shape.length - 1 ];

    return firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y;
};

/**
 * Verifies whether given shapes overlap and thus can be merged.
 * Note: this assumes each shape is not self-intersecting and has no holes.
 */
export const hasOverlap = ( shapeA: Shape, shapeB: Shape ): boolean => {
    const intersections = getIntersectionPoints1( shapeA, shapeB );
    return intersections.length > 0;
};

function getIntersectionPoints1(path1, path2) {
  const intersectionPoints = [];
  for (let i = 0; i < path1.length; i++) {
    const p1 = path1[i];
    const p2 = path1[(i + 1) % path1.length];
    for (let j = 0; j < path2.length; j++) {
      const p3 = path2[j];
      const p4 = path2[(j + 1) % path2.length];
      const intersection = getLineIntersectionA(p1, p2, p3, p4);
      if (intersection) {
        intersectionPoints.push(intersection);
      }
    }
  }
  return intersectionPoints;
}

function getLineIntersectionA(a1, a2, b1, b2) { const d = (a1.x - a2.x) * (b2.y - b1.y) - (a1.y - a2.y) * (b2.x - b1.x); if (d === 0) { return null; } const ua = ((a1.y - a2.y) * (b1.x - a1.x) - (a1.x - a2.x) * (b1.y - a1.y)) / d; const ub = ((b1.y - b2.y) * (b1.x - a1.x) - (b1.x - b2.x) * (b1.y - a1.y)) / d; if (ua < 0 || ua > 1 || ub < 0 || ub > 1) { return null; } return { x: a1.x + ua * (a2.x - a1.x), y: a1.y + ua * (a2.y - a1.y) }; }


// er?

export function mergeShapes( shapeA: Shape, shapeB: Shape ): Shape {
  const points = [ ...shapeA, ...shapeB ];
  const sortedPoints = isClockwise( points ) ? points : points.reverse();

  const intersectPoints = [];
  
  for ( let i = 0; i < sortedPoints.length; i++) {
    const current = sortedPoints[i];
    const next = sortedPoints[(i + 1) % sortedPoints.length];

    for (let j = i + 1; j < sortedPoints.length; j++) {
      const check = sortedPoints[j];
      const afterCheck = sortedPoints[(j + 1) % sortedPoints.length];
      if (doLineSegmentsIntersect(current, next, check, afterCheck)) {
        intersectPoints.push(getIntersectionPoint(current, next, check, afterCheck));
      }
    }
  }

  const uniquePoints = [...new Set([...points, ...intersectPoints].map(p => `${p.x},${p.y}`))]
    .map(str => {
      const [x, y] = str.split(',').map(Number);
      return { x, y };
    });

  return uniquePoints.sort( comparePoints );
}

function comparePoints( a: Point, b: Point ): number {
    if ( a.x === b.x ) {
        return a.y - b.y;
    }
    return a.x - b.x;
}


function clipPolygon(subjectPolygon, clipPolygon) {
  let outputList = subjectPolygon;
  let cp1 = clipPolygon[clipPolygon.length - 1];

  for (const cp2 of clipPolygon) {
    const inputList = outputList;
    outputList = [];
    let s = inputList[inputList.length - 1];

    for (const e of inputList) {
      if (isInside(e, cp1, cp2)) {
        if (!isInside(s, cp1, cp2)) {
          outputList.push(intersection(s, e, cp1, cp2));
        }
        outputList.push(e);
      } else if (isInside(s, cp1, cp2)) {
        outputList.push(intersection(s, e, cp1, cp2));
      }
      s = e;
    }
    cp1 = cp2;
  }

  return outputList;
}

function isInside(p, cp1, cp2) {
  return (cp2.x - cp1.x) * (p.y - cp1.y) > (cp2.y - cp1.y) * (p.x - cp1.x);
}

function intersection(s, e, cp1, cp2) {
  const dc = { x: cp1.x - cp2.x, y: cp1.y - cp2.y };
  const dp = { x: s.x - e.x, y: s.y - e.y };
  const n1 = cp1.x * cp2.y - cp1.y * cp2.x;
  const n2 = s.x * e.y - s.y * e.x;
  const n3 = 1.0 / (dc.x * dp.y - dc.y * dp.x);

  return { x: (n1 * dp.x - n2 * dc.x) * n3, y: (n1 * dp.y - n2 * dc.y) * n3 };
}

function isClockwise(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += (next.x - current.x) * (next.y + current.y);
  }
  return sum > 0;
}

function doLineSegmentsIntersect(a, b, c, d) {
  const denominator = ((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x));
  if (denominator === 0) {
    return false;
  }

  const numerator1 = ((a.y - c.y) * (d.x - c.x)) - ((a.x - c.x) * (d.y - c.y));
  const numerator2 = ((a.y - c.y) * (b.x - a.x)) - ((a.x - c.x) * (b.y - a.y));

  if (numerator1 === 0 || numerator2 === 0) {
    return false;
  }

  const r = numerator1 / denominator;
  const s = numerator2 / denominator;

  return (r > 0 && r < 1) && (s > 0 && s < 1);
}

function getIntersectionPoint(a, b, c, d) {
  const denominator = ((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x));
  if (denominator === 0) {
    return null;
  }

  const numerator1 = ((a.y - c.y) * (d.x - c.x)) - ((a.x - c.x) * (d.y - c.y));
  const r = numerator1 / denominator;

  const x = a.x + (r * (b.x - a.x));
  const y = a.y + (r * (b.y - a.y));

  return { x, y };
}
