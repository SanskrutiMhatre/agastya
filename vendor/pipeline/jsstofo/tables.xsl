<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     JSS to XSL-FO: Tables

     Stencil conventions: bold centered caption ABOVE the table, numbered
     "Table <chapter>-<n>", full ruling, bold header row that repeats when
     the table breaks across pages.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <!-- Computes "Table 3-1" style numbers: chapter number, then the table's
         position within that chapter. -->
    <xsl:template name="table-number">
        <xsl:variable name="chap" select="ancestor::chapter[1]"/>
        <xsl:value-of select="$chap/@number"/>
        <xsl:text>-</xsl:text>
        <xsl:number count="table[title]" from="chapter" level="any"/>
    </xsl:template>

    <xsl:template name="figure-number">
        <xsl:variable name="chap" select="ancestor::chapter[1]"/>
        <xsl:value-of select="$chap/@number"/>
        <xsl:text>-</xsl:text>
        <xsl:number count="figure[title]" from="chapter" level="any"/>
    </xsl:template>

    <!-- A table with no rows at all would produce an invalid empty fo:table -->
    <xsl:template match="table[not(.//row)]"/>

    <xsl:template match="table">
        <!-- Tables span the full text width regardless of how deeply the
             enclosing section is indented, as they do in the stencil. Without
             resetting the indents a 100%-wide table overflows the page by
             whatever start-indent the section contributed. -->
        <fo:block space-before="4mm" space-after="5mm" start-indent="0mm" end-indent="0mm">
            <xsl:if test="title">
                <fo:block text-align="center"
                          font-weight="bold"
                          font-size="{$table-font-size}"
                          space-after="2mm"
                          keep-with-next.within-page="always">
                    <xsl:attribute name="id">
                        <xsl:call-template name="element-id"/>
                    </xsl:attribute>
                    <xsl:text>Table </xsl:text>
                    <xsl:call-template name="table-number"/>
                    <xsl:text>: </xsl:text>
                    <xsl:apply-templates select="title" mode="text"/>
                </fo:block>
            </xsl:if>
            <fo:table table-layout="fixed" width="100%" font-size="{$table-font-size}"
                      border-collapse="collapse">
                <xsl:call-template name="table-columns"/>
                <xsl:if test="thead">
                    <fo:table-header>
                        <xsl:apply-templates select="thead/row"/>
                    </fo:table-header>
                </xsl:if>
                <fo:table-body>
                    <xsl:choose>
                        <xsl:when test="tbody"><xsl:apply-templates select="tbody/row"/></xsl:when>
                        <xsl:otherwise><xsl:apply-templates select="row"/></xsl:otherwise>
                    </xsl:choose>
                </fo:table-body>
            </fo:table>
        </fo:block>
    </xsl:template>

    <!--
      Column widths come from @widths (e.g. "20mm 1* 2*") when supplied,
      otherwise the available width is split evenly across the widest row.
    -->
    <xsl:template name="table-columns">
        <xsl:choose>
            <xsl:when test="@widths">
                <xsl:call-template name="emit-columns">
                    <xsl:with-param name="spec" select="normalize-space(@widths)"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:variable name="cols">
                    <xsl:call-template name="column-count"/>
                </xsl:variable>
                <xsl:call-template name="even-columns">
                    <xsl:with-param name="remaining" select="number($cols)"/>
                </xsl:call-template>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="column-count">
        <xsl:variable name="first" select="(thead/row | tbody/row | row)[1]"/>
        <xsl:value-of select="count($first/cell) + sum($first/cell[@colspan]/@colspan) - count($first/cell[@colspan])"/>
    </xsl:template>

    <xsl:template name="even-columns">
        <xsl:param name="remaining"/>
        <xsl:if test="$remaining &gt; 0">
            <fo:table-column column-width="proportional-column-width(1)"/>
            <xsl:call-template name="even-columns">
                <xsl:with-param name="remaining" select="$remaining - 1"/>
            </xsl:call-template>
        </xsl:if>
    </xsl:template>

    <!-- Splits a space-separated width list into individual fo:table-column -->
    <xsl:template name="emit-columns">
        <xsl:param name="spec"/>
        <xsl:choose>
            <xsl:when test="contains($spec, ' ')">
                <xsl:call-template name="emit-one-column">
                    <xsl:with-param name="w" select="substring-before($spec, ' ')"/>
                </xsl:call-template>
                <xsl:call-template name="emit-columns">
                    <xsl:with-param name="spec" select="normalize-space(substring-after($spec, ' '))"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:when test="$spec != ''">
                <xsl:call-template name="emit-one-column">
                    <xsl:with-param name="w" select="$spec"/>
                </xsl:call-template>
            </xsl:when>
        </xsl:choose>
    </xsl:template>

    <!-- "2*" is expanded to proportional-column-width(2); anything else is
         passed through as an absolute length. -->
    <xsl:template name="emit-one-column">
        <xsl:param name="w"/>
        <fo:table-column>
            <xsl:attribute name="column-width">
                <xsl:choose>
                    <xsl:when test="substring($w, string-length($w)) = '*'">
                        <xsl:text>proportional-column-width(</xsl:text>
                        <xsl:value-of select="substring($w, 1, string-length($w) - 1)"/>
                        <xsl:text>)</xsl:text>
                    </xsl:when>
                    <xsl:otherwise><xsl:value-of select="$w"/></xsl:otherwise>
                </xsl:choose>
            </xsl:attribute>
        </fo:table-column>
    </xsl:template>

    <!--
      Long unbroken cell values (part numbers, drawing numbers, file paths) and
      ordinary words in a narrow column otherwise print straight through the column
      rule and over the neighbouring cell. wrap-option="wrap" does not help: it is
      already the default, and the problem is not that wrapping is switched off but
      that the value offers nowhere to wrap. FOP breaks lines per UAX #14, which
      allows a break after an alphabetic hyphen, forbids one inside a numeric
      sequence, and offers none at all inside a word. So "NU-BEJS-0358-22-001A"
      breaks after "NU-" and then overflows, and "Parameter" overflows into the next
      cell in a table whose colspecs carry no colwidth and are therefore split evenly.

      The fix is to offer FOP a break opportunity at every interior position of an
      over-long token and let its line breaker choose the one that best fills the
      cell. Which character to use depends on what the token is:

        prose word   U+00AD SOFT HYPHEN, so a break renders as "Para-" / "meter".
                     FOP draws the hyphen only where it actually breaks and leaves it
                     invisible elsewhere, which is what a reader expects of a wrapped
                     word. (hyphenate="true" is not an option here: no hyphenation
                     patterns are bundled with FOP, so it silently does nothing.)

        identifier   U+200B ZERO WIDTH SPACE, never a hyphen: one inserted into the
                     middle of a part number would read as part of the number.

      Neither character needs a glyph the fonts lack: U+00AD is in WinAnsi, and FOP
      consumes U+200B as a break opportunity without asking the font for it.

      No break is offered within the first or last "edge" characters, so at least three letters stay
      on each line. Without that floor FOP, which picks the break that best
      fills the line rather than the one a dictionary would, produced
      "Fl-owrate". Tokens no
      longer than min-token are copied verbatim and pay no per-character recursion.

min-token is deliberately low. An 11-column table whose colspecs carry no
colwidth gives each column about 15mm, and at 10pt an eight-letter word such
as "Pressure" or "Flowrate" already exceeds that, so a threshold that only
caught long words left the very collisions it was meant to fix. Offering a
break costs nothing when the text fits: FOP takes one only when the line
would otherwise overflow, so wide columns are unaffected.
    -->
    <xsl:param name="table.wrap.min-token">5</xsl:param>
    <xsl:param name="table.wrap.edge">3</xsl:param>
    <xsl:variable name="zwsp" select="'&#x200B;'"/>
    <xsl:variable name="shy" select="'&#xAD;'"/>
    <xsl:variable name="alpha" select="'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'"/>

    <!-- Outranks common.xsl's verbatim text() rule, and matches cell text only,
         so every text node outside a table is left exactly as it was. -->
    <xsl:template match="text()[ancestor::cell]">
      <xsl:call-template name="soft-wrap-text">
        <xsl:with-param name="text" select="translate(., '&#10;&#13;&#9;', '   ')"/>
      </xsl:call-template>
    </xsl:template>

    <!-- Splits on spaces so only the over-long tokens are examined character by
         character; the spaces themselves are already break opportunities. -->
    <xsl:template name="soft-wrap-text">
      <xsl:param name="text"/>
      <xsl:choose>
        <xsl:when test="contains($text, ' ')">
          <xsl:call-template name="soft-wrap-token">
            <xsl:with-param name="token" select="substring-before($text, ' ')"/>
          </xsl:call-template>
          <xsl:text> </xsl:text>
          <xsl:call-template name="soft-wrap-text">
            <xsl:with-param name="text" select="substring-after($text, ' ')"/>
          </xsl:call-template>
        </xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="soft-wrap-token">
            <xsl:with-param name="token" select="$text"/>
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:template>

    <!-- A token of letters only is prose and breaks with a visible hyphen;
         anything else is an identifier and breaks invisibly. -->
    <xsl:template name="soft-wrap-token">
      <xsl:param name="token"/>
      <xsl:variable name="len" select="string-length($token)"/>
      <xsl:choose>
        <xsl:when test="$len &gt; number($table.wrap.min-token)">
          <xsl:variable name="brk">
            <xsl:choose>
              <xsl:when test="translate($token, $alpha, '') = ''">
                <xsl:value-of select="$shy"/>
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="$zwsp"/>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:variable>
          <xsl:call-template name="soft-wrap-chars">
            <xsl:with-param name="token" select="$token"/>
            <xsl:with-param name="pos" select="1"/>
            <xsl:with-param name="len" select="$len"/>
            <xsl:with-param name="brk" select="$brk"/>
          </xsl:call-template>
        </xsl:when>
        <xsl:otherwise><xsl:value-of select="$token"/></xsl:otherwise>
      </xsl:choose>
    </xsl:template>

    <!-- Emits one character at a time, following it with the break character while
         at least "edge" characters remain on either side. -->
    <xsl:template name="soft-wrap-chars">
      <xsl:param name="token"/>
      <xsl:param name="pos"/>
      <xsl:param name="len"/>
      <xsl:param name="brk"/>
      <xsl:if test="$token != ''">
        <xsl:value-of select="substring($token, 1, 1)"/>
        <xsl:if test="$pos &gt;= number($table.wrap.edge) and
                      $len - $pos &gt;= number($table.wrap.edge)">
          <xsl:value-of select="$brk"/>
        </xsl:if>
        <xsl:call-template name="soft-wrap-chars">
          <xsl:with-param name="token" select="substring($token, 2)"/>
          <xsl:with-param name="pos" select="$pos + 1"/>
          <xsl:with-param name="len" select="$len"/>
          <xsl:with-param name="brk" select="$brk"/>
        </xsl:call-template>
      </xsl:if>
    </xsl:template>

    <xsl:template match="row">
        <fo:table-row>
            <xsl:if test="ancestor::thead">
                <xsl:attribute name="font-weight">bold</xsl:attribute>
                <xsl:attribute name="keep-together.within-page">always</xsl:attribute>
            </xsl:if>
            <xsl:apply-templates select="cell"/>
        </fo:table-row>
    </xsl:template>

    <xsl:template match="cell">
        <fo:table-cell border="0.6pt solid black" padding="1.5mm">
            <xsl:if test="@colspan">
                <xsl:attribute name="number-columns-spanned"><xsl:value-of select="@colspan"/></xsl:attribute>
            </xsl:if>
            <xsl:if test="@rowspan">
                <xsl:attribute name="number-rows-spanned"><xsl:value-of select="@rowspan"/></xsl:attribute>
            </xsl:if>
            <fo:block>
                <xsl:attribute name="text-align">
                    <xsl:choose>
                        <xsl:when test="@align"><xsl:value-of select="@align"/></xsl:when>
                        <xsl:when test="ancestor::thead">center</xsl:when>
                        <xsl:otherwise>left</xsl:otherwise>
                    </xsl:choose>
                </xsl:attribute>
                <xsl:apply-templates/>
            </fo:block>
        </fo:table-cell>
    </xsl:template>

    <!-- Title is rendered by the table template itself, never inline -->
    <xsl:template match="table/title"/>
    <xsl:template match="title" mode="text">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- Every element that carries an @id, hashed by that id, so "is this the
         first element with this id?" is an O(1) key lookup rather than an O(n)
         preceding:: scan (which made large books O(n^2) to render). -->
    <xsl:key name="by-id" match="*[@id]" use="@id"/>

    <!-- Stable id for TOC/LOT links and cross-reference targets.
         Prefers the authored @id so internalRef/dmRef can point at it, but only
         for the FIRST element carrying a given @id: S1000D ids are unique only
         within a data module, so two modules can legitimately both use e.g.
         "par-001". Emitting both as an fo id would be a duplicate-id fatal in
         FOP, so any later clashing element falls back to a generated id (its
         own TOC/LOT link still works — generate-id is stable within the run —
         and the cross-reference simply resolves to the first occurrence). -->
    <xsl:template name="element-id">
        <xsl:choose>
            <xsl:when test="@id and generate-id(.) = generate-id(key('by-id', @id)[1])">
                <xsl:value-of select="@id"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="generate-id(.)"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

</xsl:stylesheet>
