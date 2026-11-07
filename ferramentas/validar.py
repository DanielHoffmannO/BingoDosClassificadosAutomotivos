#!/usr/bin/env python3
"""Confere os dados do jogo antes de publicar. Roda na pasta do projeto, sem internet:

  python3 ferramentas/validar.py

Não altera nenhum arquivo. Mostra ERRO (precisa corrigir antes de publicar) e AVISO (vale olhar).
Termina com código 1 se tiver algum ERRO.

O que confere em dados/anuncios.json e dados/cliches.json:
  · os dois arquivos abrem como JSON
  · cada anúncio tem título, ano, km, cidade, preço e descrição
  · a marcação {id:texto} ou {id~2:texto} está fechada e usa um clichê que existe em cliches.json
  · o nível da frase (~1, ~2, ~3) e o "n" do anúncio estão entre 1 e 3
  · anúncio real tem id curto (001, 002...) e a foto fotos/<id>.jpg existe
  · nenhum id ou nome de foto parece número do Facebook (15 dígitos ou mais)
  · o texto não tem telefone, e-mail, @usuário, link, endereço com número ou telefone em emoji (1️⃣4️⃣...)
Avisos: clichê que nenhum anúncio usa, foto em fotos/ que nenhum anúncio usa, km esquisito.
"""
import json, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MARCA = re.compile(r"\{(\w+)(?:~(\d))?:([^{}]+)\}")
FONE = re.compile(r"(\+?55\s?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+|(?<!\w)@\w{3,}")
LINK = re.compile(r"https?://|www\.|\.com\b|wa\.me", re.I)
ENDERECO = re.compile(r"\b(rua|r\.|av\.?|avenida|travessa|rodovia|estrada)\s+[^\n,]{2,40},?\s*(n[º°o]?\.?\s*)?\d{1,5}\b", re.I)
FONE_EMOJI = re.compile(r"(\d️?⃣\s*){2,}")
ID_FACEBOOK = re.compile(r"\d{15,}")
KM_ESQUISITO = {"0", "300", "1111", "5555", "12345", "99999"}
CAMPOS = ["t", "y", "km", "city", "p", "d"]

erros, avisos = [], []


def ler(nome):
    try:
        return json.loads((RAIZ / nome).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        sys.exit(f"ERRO {nome} não abre: {e}")


def main():
    cliches = ler("dados/cliches.json")
    anuncios = ler("dados/anuncios.json")
    usados, fotos_usadas, ids = set(), set(), set()

    for i, a in enumerate(anuncios):
        nome = f"anúncio {a.get('id') or '#' + str(i + 1)} ({str(a.get('t', ''))[:30]})"
        for c in CAMPOS:
            if not str(a.get(c, "")).strip():
                erros.append(f"{nome}: falta o campo {c}")
        if a.get("n", 1) not in (1, 2, 3):
            erros.append(f"{nome}: n tem que ser 1, 2 ou 3")
        km = re.sub(r"\D", "", str(a.get("km", "")))
        if km in KM_ESQUISITO or (len(km) >= 4 and len(set(km)) == 1):
            avisos.append(f"{nome}: km esquisito ({a.get('km')})")

        for campo in ("t", "d"):
            txt = str(a.get(campo, ""))
            for m in MARCA.finditer(txt):
                usados.add(m[1])
                if m[1] not in cliches:
                    erros.append(f"{nome}: clichê {m[1]!r} não existe em cliches.json")
                if m[2] and m[2] not in "123":
                    erros.append(f"{nome}: nível ~{m[2]} tem que ser 1, 2 ou 3")
            sobra = MARCA.sub("", txt)
            if "{" in sobra or "}" in sobra:
                erros.append(f"{nome}: chave {{ }} aberta ou sobrando no campo {campo}")
            limpo = MARCA.sub(lambda m: m[3], txt)
            for rx, oque in ((FONE, "telefone"), (EMAIL, "e-mail ou @usuário"), (LINK, "link"),
                             (ENDERECO, "endereço"), (FONE_EMOJI, "telefone em emoji")):
                m = rx.search(limpo)
                if m:
                    erros.append(f"{nome}: parece {oque} no texto: {m[0].strip()!r}")
        if a.get("dedo"):
            usados.add("dedo")

        if a.get("real"):
            aid = str(a.get("id", ""))
            if not re.fullmatch(r"\d{3,4}", aid):
                erros.append(f"{nome}: id tem que ser curto, tipo 001")
            if aid in ids:
                erros.append(f"{nome}: id repetido")
            ids.add(aid)
            foto = a.get("foto")
            if foto:
                fotos_usadas.add(foto)
                if not (RAIZ / foto).is_file():
                    erros.append(f"{nome}: foto {foto} não existe")
        for campo in ("id", "foto"):
            if ID_FACEBOOK.search(str(a.get(campo, ""))):
                erros.append(f"{nome}: {campo} parece número do Facebook ({a.get(campo)})")

    for k in cliches:
        if k not in usados:
            avisos.append(f"clichê {k!r} ({cliches[k]}) não aparece em nenhum anúncio")
    for f in sorted((RAIZ / "fotos").glob("*")):
        rel = f"fotos/{f.name}"
        if ID_FACEBOOK.search(f.name):
            erros.append(f"{rel}: nome parece número do Facebook (mova para anuncios/, que não vai para o GitHub)")
        elif rel not in fotos_usadas:
            avisos.append(f"{rel}: nenhum anúncio usa esta foto")

    for a in avisos:
        print("AVISO", a)
    for e in erros:
        print("ERRO ", e)
    reais = sum(1 for a in anuncios if a.get("real"))
    print(f"\n{len(anuncios)} anúncios ({reais} reais), {len(cliches)} clichês: "
          f"{len(erros)} erro(s), {len(avisos)} aviso(s).")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
