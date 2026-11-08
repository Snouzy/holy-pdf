---
section: guides
lang: pt-br
topics: [administrative-documents, ocr, privacy, scan]
slug: como-tornar-pdf-pesquisavel
title: Como tornar um PDF pesquisável com OCR
description: "Use OCR para tornar um PDF digitalizado pesquisável e copiável. Veja o passo a passo, como testar o resultado e quais são as limitações."
h1: Como tornar um PDF pesquisável com OCR
author: Mathias
lead: Aplique OCR para adicionar uma camada de texto invisível às páginas digitalizadas. A aparência do documento continua a mesma, mas você pode pesquisar e copiar palavras.
image: /articles/searchable-pdf/searchable-pdf-hero.webp
published: 2026-11-02
---

<figure class="article-visual article-visual--hero">
  <img src="/articles/searchable-pdf/searchable-pdf-hero.webp" alt="Uma lupa encontra palavras em uma página digitalizada de PDF" width="1600" height="900" loading="eager" decoding="async" />
  <figcaption>O OCR coloca texto pesquisável sobre a imagem da página sem mudar sua aparência.</figcaption>
</figure>

Para tornar um PDF pesquisável, abra o [OCR PDF](/pt-br/ocr-pdf), escolha o arquivo e selecione **Reconhecer o texto**. O Holy PDF lê as páginas digitalizadas em português e inglês e cria uma nova cópia com uma camada de texto invisível. Depois, você pode usar a busca do leitor de PDF e selecionar trechos para copiar.

Esse processo é indicado para documentos que vieram de um scanner ou da câmera do celular. Se você já consegue pesquisar uma palavra no arquivo original, ele provavelmente já tem texto e talvez não precise de OCR.

## O que significa um PDF pesquisável

Em muitos PDFs digitalizados, cada página é apenas uma imagem. Você vê letras, números e tabelas, mas o leitor de PDF não reconhece essas formas como texto. Por isso, `Ctrl + F` ou `⌘ + F` não encontra uma palavra, e não dá para selecionar uma frase normalmente.

O reconhecimento óptico de caracteres, conhecido pela sigla OCR, identifica as palavras da imagem. A ferramenta adiciona o resultado como texto invisível na posição correspondente de cada linha. A imagem original da página continua visível.

Com a cópia pesquisável, você pode:

- localizar um nome, número ou assunto em um documento longo;
- copiar um trecho para outro programa;
- organizar digitalizações que precisam ser consultadas depois.

OCR não é o mesmo que editar o documento. A ferramenta **não corrige nem substitui o texto que aparece na imagem da página**. Se ela reconhecer uma palavra de forma incorreta, a aparência continuará igual, mas a busca e o texto copiado poderão conter o erro.

## Como tornar o PDF pesquisável

1. Abra o [OCR PDF do Holy PDF](/pt-br/ocr-pdf).
2. Clique em **Escolha um arquivo PDF** e selecione o documento digitalizado.
3. Confira se as páginas estão na orientação correta.
4. Selecione **Reconhecer o texto**.
5. Aguarde a leitura das páginas. Ao terminar, selecione **Baixar o PDF**.
6. Abra a nova cópia e pesquise uma palavra que apareça claramente no documento.

<figure class="article-visual">
  <picture>
    <source media="(max-width: 40rem)" srcset="/articles/searchable-pdf/holy-pdf-ocr-ui-pt-br-mobile.webp" width="390" height="900" />
    <img src="/articles/searchable-pdf/holy-pdf-ocr-ui-pt-br.webp" alt="Interface em português do OCR PDF do Holy PDF com um documento digitalizado fictício pronto para o reconhecimento de texto" width="1400" height="900" loading="lazy" decoding="async" />
  </picture>
  <figcaption>Na interface atual, o botão “Reconhecer o texto” inicia o OCR.</figcaption>
</figure>

O processamento acontece no navegador. O PDF não é enviado ao Holy PDF. Se quiser entender esse modelo antes de abrir um documento, leia [Seus PDFs ficam no seu dispositivo](/pt-br/blog/seus-pdfs-ficam-no-seu-dispositivo).

## Como conferir se o OCR funcionou

Não avalie o resultado apenas pela aparência: a página deve continuar visualmente igual. Abra o arquivo baixado em um leitor de PDF e faça três testes:

1. use `Ctrl + F` no Windows ou Linux, ou `⌘ + F` no Mac, e busque uma palavra nítida da página;
2. selecione uma frase e copie-a para um editor de texto;
3. compare o texto copiado com a imagem, prestando atenção a acentos, números e nomes próprios.

Faça o teste em mais de uma página. Uma busca que encontra uma palavra não garante que todo o documento foi reconhecido sem erros.

Se o Holy PDF mostrar **Cada página já tem o seu texto: não há nada para ler.**, isso significa que todas as páginas já têm pelo menos 50 caracteres de texto. Nesse caso, teste a busca no arquivo original.

## Por que algumas páginas não entram no OCR

O Holy PDF verifica quanto texto cada página já contém. Na implementação atual, só entram no OCR as páginas com **menos de 50 caracteres de texto**. Isso evita reler uma página que já tem uma camada textual, mas cria uma exceção importante: uma página pode ter uma imagem com muitas palavras e, ao mesmo tempo, 50 caracteres ou mais em outro elemento. Essa página será ignorada.

O OCR da versão brasileira reconhece **português e inglês**. Não há seletor de idioma. Um documento em outro idioma pode perder acentos ou ter mais erros de leitura.

Se nenhuma palavra puder ser reconhecida, a ferramenta informa **Nenhum texto pôde ser lido nas páginas.** e não cria uma cópia idêntica sem utilidade.

## Como melhorar o reconhecimento

A qualidade do OCR depende da imagem. Antes de tentar novamente:

- deixe a página na posição correta, sem texto de lado ou de cabeça para baixo;
- prefira uma digitalização nítida, com bom contraste;
- evite sombras, reflexos, desfoque e cortes nas bordas;
- confira se letras pequenas continuam legíveis ao ampliar a página;
- use uma imagem reta, sem perspectiva de foto inclinada.

A rotação definida na página do PDF é respeitada pelo OCR. O caso problemático é quando o texto está girado dentro da própria imagem, por exemplo, a 90 graus. O mecanismo atual não detecta bem essa orientação, e o reconhecimento tende a falhar. Nesse caso, corrija a imagem e gere o PDF novamente antes de aplicar o OCR.

Se você ainda tem as fotos das páginas, [Digitalizar para PDF](/pt-br/digitalizar-para-pdf) ajuda a alinhar e limpar as imagens antes de reuni-las. A opção **Texto pesquisável** também pode adicionar OCR durante a criação do documento.

## Limites do OCR no Holy PDF

Conhecer os limites evita esperar do OCR algo que ele não faz:

- a versão brasileira lê português e inglês, sem escolha de outros idiomas;
- páginas com 50 caracteres de texto já existente ou mais não são processadas;
- texto girado dentro da imagem pode ser reconhecido de forma incorreta;
- não há botão para cancelar enquanto a leitura está em andamento;
- o resultado pode conter erros, especialmente em imagens de baixa qualidade, letras pequenas e layouts complexos; o reconhecimento de manuscritos não foi validado;
- o OCR acrescenta uma camada invisível, mas não edita o texto visível da digitalização.

Guarde o arquivo original. A cópia com OCR serve para busca e seleção, não para substituir o arquivo de origem nem para provar que cada palavra foi transcrita corretamente.

## Perguntas frequentes

### Dá para tornar um PDF pesquisável sem mudar a aparência?

Sim. O Holy PDF mantém a página visível e adiciona uma camada de texto invisível sobre ela. Os testes do motor verificam que essa camada não aparece na renderização da página.

### O OCR funciona em português com acentos?

Sim. Na página brasileira, o reconhecimento usa português e inglês. Os testes atuais incluem uma frase em português com “não”, “informação”, “ação” e “conclusão”, preservando os acentos nesse exemplo. Ainda assim, confira seu próprio arquivo: a qualidade da imagem influencia o resultado.

### Por que não consigo pesquisar no PDF mesmo vendo as palavras?

Provavelmente a página é uma imagem sem camada de texto, ou o reconhecimento não conseguiu ler aquela palavra. Aplique OCR e teste a cópia baixada. Se a página já continha 50 caracteres ou mais, ela pode ter sido ignorada pela regra atual.

### Um PDF pesquisável também fica editável?

Não necessariamente. No Holy PDF, o OCR permite pesquisar, selecionar e copiar. Ele não transforma a imagem original em parágrafos editáveis. Para obter um documento editável, primeiro aplique o OCR e depois envie a cópia pesquisável ao [PDF para Word](/pt-br/pdf-para-word). Revise o texto e o layout do resultado.

### Posso aplicar OCR a várias páginas de uma vez?

Sim. Escolha um único PDF com várias páginas. A ferramenta examina cada página e processa apenas as que têm menos de 50 caracteres de texto já existente.

### O arquivo é enviado para um servidor?

Não. O reconhecimento e a criação da cópia acontecem no navegador, no seu dispositivo.

## Fontes oficiais

- [Especificação do OCR para Web do Holy PDF](https://github.com/Snouzy/holy-pdf/blob/main/wiki/specs/2026-10-02-web-ocr-design.md)
- [Adobe — Como reconhecer texto em documentos digitalizados](https://helpx.adobe.com/br/acrobat/desktop/create-documents/scan-documents-to-pdfs/recognize-text.html)
- [Adobe — Converter PDFs digitalizados em arquivos editáveis e pesquisáveis com OCR](https://www.adobe.com/br/acrobat/how-to/ocr-software-convert-pdf-to-text.html)
