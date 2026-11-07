# Bingo dos Classificados Automotivos

Único dono, só pegar e andar, leia o anúncio até o final: todo vendedor de carro escreve igual.
Neste jogo você abre anúncios de carro, acha os clichês da sua cartela e fecha uma linha.

**Jogar:** https://danielhoffmanno.github.io/BingoDosClassificadosAutomotivos/

## Como jogar

1. Abra um anúncio. O relógio só começa depois disso.
2. Clique nas frases da sua cartela que aparecem no título ou na descrição.
3. Frase escrita certinha vale 10, com erro ou gíria 20, disfarçada 30. Linha fechada vale +50.
4. Clicar no que não é clichê tira ponto.

| Nível | Tempo | Clique errado | Para ganhar |
|---|---|---|---|
| Fácil | 5 min | −1 | 1 linha (mostra quantas frases cada anúncio tem) |
| Médio | 4 min | −3 | 1 linha |
| Difícil | 3 min | −5 | cartela cheia, mais frases com erro ou disfarçadas, e cada acerto devolve tempo |
| Personalizada | você escolhe | você escolhe | você escolhe |

## Rodar no computador

Os dados ficam em arquivos JSON, que o navegador só carrega de um servidor:

```
python3 -m http.server
```

Depois abra http://localhost:8000.

## Pastas

- `index.html`, `css/estilo.css` e `js/jogo.js` têm a página e o jogo.
- `dados/anuncios.json` tem todos os anúncios. Os reais têm `"real": true`, um id curto (001, 002...) e a foto em `fotos/<id>.jpg`, com a placa tampada.
- `dados/cliches.json` tem os clichês da cartela.
- `ferramentas/` tem scripts de apoio. Rode `python3 ferramentas/validar.py` antes de publicar: ele avisa se sobrou telefone, endereço, link ou marcação quebrada.
- `anuncios/` tem os originais e a tabela de ids. Essa pasta está no `.gitignore` e não vai para o GitHub.

## Marcação dos clichês

Na descrição, um clichê fica entre chaves: `{unico:Único dono}`. O nível vai depois do til:
`{fipe~2:abaixo da fipi}` (com erro ou gíria) ou `{leia~3:lê tudo antes}` (disfarçada).
Sem til, vale o `"n"` do anúncio.

## Sobre os anúncios

Os anúncios reais foram copiados à mão do Facebook Marketplace e estão do jeito que o vendedor escreveu,
mas sem nome, telefone, endereço e placa. Os inventados só imitam.
