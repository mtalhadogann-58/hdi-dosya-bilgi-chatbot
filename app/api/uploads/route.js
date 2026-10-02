import crypto from "crypto";


export const runtime =
  "nodejs";


const MAX_SIZE =
  10 *
  1024 *
  1024;


const ALLOWED_TYPES =
  new Set([
    "application/pdf",

    "image/png",

    "image/jpeg",

    "application/msword",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]);


export async function POST(
  request
) {

  try {

    const form =
      await request.formData();


    const file =
      form.get(
        "file"
      );


    if (
      !file ||
      typeof file.arrayBuffer !==
        "function"
    ) {
      return Response.json(
        {
          error:
            "Dosya bulunamadı."
        },
        {
          status: 400
        }
      );
    }


    if (
      file.size >
      MAX_SIZE
    ) {
      return Response.json(
        {
          error:
            "Demo ortamında dosya boyutu en fazla 10 MB olabilir."
        },
        {
          status: 413
        }
      );
    }


    if (
      file.type &&
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {
      return Response.json(
        {
          error:
            "Bu dosya tipi demo ortamında desteklenmiyor."
        },
        {
          status: 415
        }
      );
    }


    const bytes =
      Buffer.from(
        await file.arrayBuffer()
      );


    const sha256 =
      crypto
        .createHash(
          "sha256"
        )
        .update(
          bytes
        )
        .digest(
          "hex"
        );


    return Response.json({
      file: {
        id:
          `UP-${sha256.slice(
            0,
            12
          )}`,

        name:
          file.name,

        type:
          file.type ||
          "application/octet-stream",

        size:
          file.size,

        sha256:
          sha256.slice(
            0,
            16
          ),

        status:
          "RECEIVED",

        receivedAt:
          new Date()
            .toISOString()
      }
    });


  } catch (
    error
  ) {

    console.error(
      "Upload error:",
      error
    );


    return Response.json(
      {
        error:
          "Dosya yüklenirken beklenmeyen bir hata oluştu."
      },
      {
        status: 500
      }
    );

  }
}
