'use client';

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
} from 'tldraw';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Define the shape type
export type LaTeXShape = TLBaseShape<
  'latex',
  {
    latex: string;
    w: number;
    h: number;
    color: string;
    fontSize: number;
  }
>;

// Shape props validation
export const latexShapeProps: RecordProps<LaTeXShape> = {
  latex: T.string,
  w: T.number,
  h: T.number,
  color: T.string,
  fontSize: T.number,
};

// Shape utility class
export class LaTeXShapeUtil extends BaseBoxShapeUtil<LaTeXShape> {
  static override type = 'latex' as const;
  static override props = latexShapeProps;

  getDefaultProps(): LaTeXShape['props'] {
    return {
      latex: 'x^2 + y^2 = z^2',
      w: 200,
      h: 60,
      color: '#1a1a1a',
      fontSize: 24,
    };
  }

  component(shape: LaTeXShape) {
    let html = '';
    let error = false;

    try {
      html = katex.renderToString(shape.props.latex, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
      });
    } catch (e) {
      error = true;
      html = `<span style="color: red;">Invalid LaTeX: ${shape.props.latex}</span>`;
    }

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'all',
          padding: '8px 16px',
        }}
      >
        <div
          style={{
            color: shape.props.color,
            fontSize: shape.props.fontSize,
            lineHeight: 1.4,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </HTMLContainer>
    );
  }

  indicator(shape: LaTeXShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={4} ry={4} />;
  }

  override canEdit = () => false;
  override canResize = () => true;
  override isAspectRatioLocked = () => false;

  override onResize(shape: LaTeXShape, info: { newPoint: { x: number; y: number }; handle: string; scaleX: number; scaleY: number; initialShape: LaTeXShape }) {
    return {
      props: {
        w: Math.max(50, info.initialShape.props.w * info.scaleX),
        h: Math.max(30, info.initialShape.props.h * info.scaleY),
      },
    };
  }
}
