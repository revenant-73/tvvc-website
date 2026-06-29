import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

export const GET = async ({ url }) => {
  const title = url.searchParams.get('title') || 'Tualatin Valley Volleyball Club';
  const description = url.searchParams.get('description') || 'Hillsboro, OR';
  const badge = url.searchParams.get('badge') || '';

  // Load fonts
  const syneBold = fs.readFileSync(path.resolve('./node_modules/@fontsource/syne/files/syne-latin-700-normal.woff'));
  const interRegular = fs.readFileSync(path.resolve('./node_modules/@fontsource/inter/files/inter-latin-400-normal.woff'));

  // Load logo as base64
  const logoPath = path.resolve('./public/assets/images/tvvc-logo.png');
  const logoData = fs.readFileSync(logoPath).toString('base64');
  const logoSrc = `data:image/png;base64,${logoData}`;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1A1A1A', // Charcoal
          padding: '40px',
          color: 'white',
          fontFamily: 'Inter',
        },
        children: [
          // Background accents
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '-100px',
                right: '-100px',
                width: '400px',
                height: '400px',
                borderRadius: '200px',
                backgroundColor: '#009695', // Teal
                opacity: 0.1,
              }
            }
          },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '-100px',
                left: '-100px',
                width: '400px',
                height: '400px',
                borderRadius: '200px',
                backgroundColor: '#E85D4E', // Coral
                opacity: 0.1,
              }
            }
          },
          // Logo
          {
            type: 'img',
            props: {
              src: logoSrc,
              style: {
                width: '120px',
                marginBottom: '40px',
              }
            }
          },
          // Content
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              },
              children: [
                badge ? {
                  type: 'div',
                  props: {
                    style: {
                      backgroundColor: '#E85D4E',
                      color: 'white',
                      padding: '8px 20px',
                      borderRadius: '99px',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      marginBottom: '20px',
                      textTransform: 'uppercase',
                    },
                    children: badge
                  }
                } : null,
                {
                  type: 'h1',
                  props: {
                    style: {
                      fontSize: '72px',
                      fontFamily: 'Syne',
                      fontWeight: '700',
                      margin: '0 0 20px 0',
                      lineHeight: 1.1,
                    },
                    children: title
                  }
                },
                {
                  type: 'p',
                  props: {
                    style: {
                      fontSize: '32px',
                      opacity: 0.8,
                      margin: 0,
                    },
                    children: description
                  }
                }
              ]
            }
          },
          // Footer
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '40px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '20px',
                opacity: 0.5,
              },
              children: [
                { type: 'span', props: { children: 'tualatinvalleyvb.com' } }
              ]
            }
          }
        ]
      }
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Syne',
          data: syneBold,
          weight: 700,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: interRegular,
          weight: 400,
          style: 'normal',
        },
      ],
    }
  );

  const resvg = new Resvg(svg, {
    background: '#1A1A1A',
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
