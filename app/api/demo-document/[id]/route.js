export const runtime =
  "nodejs";


function escapePdf(
  value = ""
) {
  return String(
    value
  )
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /\(/g,
      "\\("
    )
    .replace(
      /\)/g,
      "\\)"
    );
}


function createPdf({
  id,
  claimNo
}) {

  const lines = [
    "HDI Sigorta Demo Belgesi",

    "",

    `Belge ID: ${id}`,

    `Hasar Dosya No: ${claimNo || "Demo"}`,

    "",

    "Bu dokuman HDI CR AI PoC kapsaminda",

    "Talha AI tarafindan olusturulmus",

    "sentetik bir demo belgesidir.",

    "",

    "Gercek musteri veya hasar verisi icermez."
  ];


  const commands = [];

  /*
   * Green HDI header
   */
  commands.push(
    "q"
  );

  commands.push(
    "0.02 0.53 0.30 rg"
  );

  commands.push(
    "42 725 105 42 re f"
  );

  commands.push(
    "Q"
  );


  /*
   * HDI text
   */
  commands.push(
    "BT"
  );

  commands.push(
    "/F1 24 Tf"
  );

  commands.push(
    "1 1 1 rg"
  );

  commands.push(
    "66 738 Td"
  );

  commands.push(
    "(HDI) Tj"
  );

  commands.push(
    "ET"
  );


  commands.push(
    "BT"
  );

  commands.push(
    "/F1 17 Tf"
  );

  commands.push(
    "0.08 0.12 0.10 rg"
  );

  commands.push(
    "42 685 Td"
  );


  lines.forEach(
    (
      line,
      index
    ) => {

      if (
        index ===
        0
      ) {
        commands.push(
          `(${escapePdf(
            line
          )}) Tj`
        );
      } else {
        commands.push(
          "0 -23 Td"
        );

        commands.push(
          `(${escapePdf(
            line
          )}) Tj`
        );
      }

    }
  );


  commands.push(
    "ET"
  );


  const stream =
    commands.join(
      "\n"
    );


  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,

    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,

    `<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 595 842]
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
/Contents 4 0 R
>>`,

    `<< /Length ${Buffer.byteLength(
      stream,
      "utf8"
    )} >>
stream
${stream}
endstream`,

    `<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>`
  ];


  let pdf =
    "%PDF-1.4\n";


  const offsets =
    [0];


  objects.forEach(
    (
      object,
      index
    ) => {

      offsets.push(
        Buffer.byteLength(
          pdf,
          "utf8"
        )
      );


      pdf +=
        `${index + 1} 0 obj\n${object}\nendobj\n`;

    }
  );


  const xrefOffset =
    Buffer.byteLength(
      pdf,
      "utf8"
    );


  pdf +=
    `xref\n0 ${objects.length + 1}\n`;


  pdf +=
    "0000000000 65535 f \n";


  for (
    let index = 1;
    index <=
    objects.length;
    index++
  ) {

    pdf +=
      `${String(
        offsets[index]
      ).padStart(
        10,
        "0"
      )} 00000 n \n`;

  }


  pdf +=
    `trailer
<<
/Size ${objects.length + 1}
/Root 1 0 R
>>
startxref
${xrefOffset}
%%EOF`;


  return Buffer.from(
    pdf,
    "utf8"
  );
}


export async function GET(
  request,
  context
) {

  const params =
    await Promise.resolve(
      context.params
    );


  const id =
    params?.id ||
    "DEMO";


  const claimMatch =
    String(
      id
    ).match(
      /\d{6,}/
    );


  const claimNo =
    claimMatch?.[0] ||
    null;


  const pdf =
    createPdf({
      id,
      claimNo
    });


  return new Response(
    pdf,
    {
      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `inline; filename="HDI_Demo_${id}.pdf"`,

        "Cache-Control":
          "no-store"
      }
    }
  );
}
