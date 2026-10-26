<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Tables Module
     
     Contains templates for table processing.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">
  <!-- ==================================================================== -->
  <!--                         TABLE ATTRIBUTE SETS                          -->
  <!-- ==================================================================== -->
  <!-- Outer frame closed on all four sides, to match the full-grid cell
       ruling above (it previously had no start/end edge). -->
  <xsl:attribute-set name="table">
    <xsl:attribute name="border-before-width.conditionality">retain</xsl:attribute>
    <xsl:attribute name="border-collapse">collapse</xsl:attribute>
    <xsl:attribute name="border">0.6pt solid black</xsl:attribute>
    <xsl:attribute name="table-layout">fixed</xsl:attribute>
    <xsl:attribute name="width">100%</xsl:attribute>
  </xsl:attribute-set>
  <xsl:attribute-set name="table-bordered">
    <xsl:attribute name="border-before-width.conditionality">retain</xsl:attribute>
    <xsl:attribute name="border-collapse">collapse</xsl:attribute>
    <xsl:attribute name="border-start-style">solid</xsl:attribute>
    <xsl:attribute name="border-end-style">solid</xsl:attribute>
    <xsl:attribute name="border-top-style">solid</xsl:attribute>
    <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
    <xsl:attribute name="border-start-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-end-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-top-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-bottom-width">0.5pt</xsl:attribute>
    <xsl:attribute name="border-start-color">black</xsl:attribute>
    <xsl:attribute name="border-end-color">black</xsl:attribute>
    <xsl:attribute name="border-top-color">black</xsl:attribute>
    <xsl:attribute name="border-bottom-color">black</xsl:attribute>
    <xsl:attribute name="table-layout">fixed</xsl:attribute>
    <xsl:attribute name="width">100%</xsl:attribute>
  </xsl:attribute-set>
  <!--
    Cells carry a full box border so tables render as a complete grid, matching
    the JSS pipeline's look (which puts border="0.6pt solid black" on every
    cell). Previously only horizontal rules were drawn — the CALS-faithful
    reading of rowsep/colsep, which left tables with no vertical separators and
    no outer left/right edge. The per-cell rowsep/colsep rules further down are
    now redundant rather than wrong: they re-assert edges this already draws.
  -->
  <xsl:attribute-set name="header-cell">
    <xsl:attribute name="padding">1.5mm</xsl:attribute>
    <xsl:attribute name="border">0.6pt solid black</xsl:attribute>
    <xsl:attribute name="text-align">left</xsl:attribute>
  </xsl:attribute-set>
  <xsl:attribute-set name="body-cell">
    <xsl:attribute name="padding">1.5mm</xsl:attribute>
    <xsl:attribute name="border">0.6pt solid black</xsl:attribute>
    <xsl:attribute name="text-align">left</xsl:attribute>
  </xsl:attribute-set>
  <!-- ==================================================================== -->
  <!--                         TABLE TEMPLATE                                -->
  <!-- ==================================================================== -->
  <xsl:template match="table">
    <!-- $table.indent, not 0: pinned to the margin the table began under the
         heading's NUMBER rather than beside its text, so it hung left of
         everything around it. The fo:table inside still uses 0pt, which is
         relative to this block. -->
    <fo:block padding-top="{$standard-leading}" start-indent="{$table.indent}">
      <xsl:attribute name="id">
        <xsl:choose>
          <xsl:when test="@id">
            <xsl:call-template name="generate-link-id">
              <xsl:with-param name="localId" select="@id"/>
            </xsl:call-template>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>table-auto-</xsl:text>
            <xsl:value-of select="generate-id()"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>
      <!-- Table caption -->
      <fo:block font-style="italic" text-align="center" space-after="6pt">
        <xsl:apply-templates select="." mode="label"/>
        <xsl:text>  </xsl:text>
        <xsl:value-of select="title"/>
      </fo:block>
      <xsl:apply-templates select="tgroup"/>
    </fo:block>
  </xsl:template>
  <xsl:template match="table" mode="number">
    <xsl:choose>
      <!-- JSS format: chapter-based numbering (1-1, 1-2, etc.) -->
      <xsl:when test="contains($document.format, 'JSS')">
        <!-- Chapter number (count description|procedure|faultIsolation|crew up to current chapter) -->
        <xsl:variable name="chapter-number">
          <xsl:number count="description|procedure|faultIsolation|crew" level="any" from="content"/>
        </xsl:variable>
        <!-- Table number within chapter -->
        <xsl:variable name="table-in-chapter">
          <xsl:number count="table|reqCondGroup|reqSupportEquips|reqSupplies|reqSpares" level="any" from="description|procedure|faultIsolation|crew"/>
        </xsl:variable>
        <xsl:value-of select="$chapter-number"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="$table-in-chapter"/>
      </xsl:when>
      <!--
        Per data module, and not currently offered as a choice.

        The References table carries a hardcoded "Table 1" in every module,
        which is the S1000D convention and correct while numbering restarts per
        module. Counting through the book instead would leave seventeen
        Table 1s standing beside tables numbered 7, 11 and 18. Figures have no
        such fixed caption, which is why they DO offer the choice.
      -->
      <xsl:otherwise>
        <xsl:number count="content|reqCondGroup|reqSupportEquips|reqSupplies|reqSpares|table" 
            level="any" from="dmodule"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <xsl:template match="table" mode="label">
    <xsl:text>Table </xsl:text>
    <xsl:apply-templates select="." mode="number"/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         TGROUP TEMPLATE                               -->
  <!-- ==================================================================== -->
  <!--
    A table declares its columns with <colspec>, but authored CALS routinely
    disagrees with itself: a tgroup says cols="2" while a row carries three or
    four <entry> elements, usually because columns of data were added and the
    count was never updated. FOP treats that as FATAL ("the number of cells in
    the row overflows the number of fo:table-columns") and abandons the entire
    render, so one bad table meant no PDF at all.

    Declaring enough columns for the widest row keeps the document renderable.
    The extra columns are proportional, so a correct table is completely
    unaffected — count(colspec) already covers its widest row, and nothing is
    added.
  -->
  <xsl:template match="tgroup">
    <xsl:variable name="declared" select="count(colspec)"/>
    <!-- XSLT 1.0 has no max(): sort the rows by cell count and take the first. -->
    <xsl:variable name="widest">
      <xsl:for-each select="thead/row | tbody/row | row">
        <xsl:sort select="count(entry)" data-type="number" order="descending"/>
        <xsl:if test="position() = 1"><xsl:value-of select="count(entry)"/></xsl:if>
      </xsl:for-each>
    </xsl:variable>
    <!--
      No start-indent here, deliberately: it INHERITS the wrapper's.

      start-indent is an inherited property whose computed value is measured
      from the reference area — the region body — not from the parent block.
      So "0pt" here does not mean "flush with my parent", it means "flush with
      the page margin", and it cancelled the wrapper's indent outright. The
      wrapper appeared correct in the FO and the table still rendered hard
      against the margin, which is a difficult thing to see by reading the
      output.

      end-indent stays 0pt for the same reason read the other way: it pins the
      right edge to the region's end, so the table still runs to the margin.
    -->
    <fo:table xsl:use-attribute-sets="table-bordered" table-omit-header-at-break="false"
        end-indent="0pt">
      <xsl:apply-templates select="colspec"/>
      <xsl:call-template name="filler-columns">
        <xsl:with-param name="n" select="number($widest) - $declared"/>
      </xsl:call-template>
      <xsl:apply-templates select="thead"/>
      <xsl:apply-templates select="tbody"/>
    </fo:table>
  </xsl:template>
  <!-- $n equal-width columns; nothing at all when $n is zero, negative or NaN. -->
  <xsl:template name="filler-columns">
    <xsl:param name="n"/>
    <xsl:if test="$n &gt;= 1">
      <fo:table-column column-width="proportional-column-width(1)"/>
      <xsl:call-template name="filler-columns">
        <xsl:with-param name="n" select="$n - 1"/>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         COLUMN SPEC                                   -->
  <!-- ==================================================================== -->
  <xsl:template match="colspec">
    <fo:table-column>
      <xsl:apply-templates select="@colwidth"/>
    </fo:table-column>
  </xsl:template>
  <xsl:template match="@colwidth">
    <xsl:attribute name="column-width">
      <xsl:choose>
        <xsl:when test="contains(., '*')">
          <xsl:value-of select="concat('proportional-column-width(', substring-before(., '*'), ')')"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="."/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:attribute>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         TABLE HEADER                                  -->
  <!-- ==================================================================== -->
  <xsl:template match="thead">
    <fo:table-header start-indent="0pt" end-indent="0pt" font-weight="bold">
      <xsl:apply-templates select="row"/>
    </fo:table-header>
  </xsl:template>
  <xsl:template match="thead//para">
    <fo:block font-weight="bold">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         TABLE BODY                                    -->
  <!-- ==================================================================== -->
  <xsl:template match="tbody">
    <fo:table-body start-indent="0pt" end-indent="0pt">
      <xsl:apply-templates select="row"/>
    </fo:table-body>
  </xsl:template>
  <xsl:template match="tbody//para">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    SOFT WRAPPING IN CELLS                             -->
  <!-- ==================================================================== -->
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

  <!-- Outranks the built-in text() rule, and matches cell text only, so every
       text node outside a table is left exactly as it was. -->
  <xsl:template match="text()[ancestor::entry]">
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

  <!-- ==================================================================== -->
  <!--                         TABLE ROWS                                    -->
  <!-- ==================================================================== -->
  <xsl:template match="row">
    <fo:table-row keep-together.within-column="always">
      <xsl:if test="parent::thead">
        <xsl:attribute name="keep-with-next.within-column">always</xsl:attribute>
      </xsl:if>
      <xsl:apply-templates select="entry"/>
    </fo:table-row>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                         TABLE CELLS                                   -->
  <!-- ==================================================================== -->
  <!--
    An entry's own alignment, or the column's, or whatever the attribute sets
    already default to (left, and however display-align resolves with none
    set — top, in practice).

    CALS lets a table author say a column is centred, or its content sits at
    the top or bottom of a taller row, once on its <colspec> — rather than
    repeating the attribute on every entry down the column, which is the
    ordinary case for a "Sr. No." column or a table whose rows vary in
    height. Those colspecs were read for nothing but width; @align and
    @valign, on them and on an entry itself, were silently ignored, so a
    table authored fully to the CALS model still printed every cell flush
    left and top-aligned.

    One template resolves both attributes — $attr names which — so the
    colname/namest/position rule for finding an entry's column is written
    once rather than twice and kept in exact agreement between the two.

    An entry naming its column by @colname is matched to that colspec
    directly. One with no @colname is matched by ordinal position among the
    entries actually present in ITS OWN row — the row's Nth entry to the
    tgroup's Nth colspec — which is the CALS rule for an unlabelled entry and
    is exactly right for a row with no spanned cells before it. A row after a
    colspanned cell would be off by however many columns that span covered;
    fixing that needs tracking how many physical columns every entry so far
    has consumed, which this table renderer does not do anywhere yet, so it
    is left as the one case this still gets wrong rather than guessed at.
  -->
  <xsl:template name="entry-cell-attr">
    <xsl:param name="attr"/>
    <!--
      Each colspec is looked up directly with its own XPath predicate rather
      than through a stored "the matching colspec" variable: a variable's
      select is one expression, and choosing between colname/namest/position
      needs a genuine xsl:choose. Repeating the predicate costs nothing here —
      a tgroup's colspec list is a handful of nodes — and keeps everything a
      real node-set, with no RTF/node-set() extension needed to read the
      attribute back out of it.

      @*[local-name() = $attr] rather than a literal @align/@valign, since
      $attr is only known at run time — XPath 1.0 has no @{$name} syntax.
    -->
    <xsl:variable name="colspecs" select="ancestor::tgroup/colspec"/>
    <xsl:choose>
      <xsl:when test="@*[local-name() = $attr]">
        <xsl:value-of select="@*[local-name() = $attr]"/>
      </xsl:when>
      <xsl:when test="@colname and $colspecs[@colname = current()/@colname]/@*[local-name() = $attr]">
        <xsl:value-of select="$colspecs[@colname = current()/@colname][1]/@*[local-name() = $attr]"/>
      </xsl:when>
      <xsl:when test="@namest and $colspecs[@colname = current()/@namest]/@*[local-name() = $attr]">
        <xsl:value-of select="$colspecs[@colname = current()/@namest][1]/@*[local-name() = $attr]"/>
      </xsl:when>
      <xsl:when test="not(@colname) and not(@namest)
                       and $colspecs[position() = count(current()/preceding-sibling::entry) + 1]/@*[local-name() = $attr]">
        <xsl:value-of select="$colspecs[position() = count(current()/preceding-sibling::entry) + 1][1]/@*[local-name() = $attr]"/>
      </xsl:when>
    </xsl:choose>
  </xsl:template>

  <!--
    CALS' vertical @valign (top/middle/bottom) to XSL-FO's display-align
    (before/center/after) — different words for the same three positions,
    because CALS was never an FO vocabulary and FOP's property is the
    generic before/after pairing every block-progression property uses.
    Anything else (including no @valign anywhere) is left unset, so display-
    align keeps its formatter default rather than this stylesheet asserting
    one — the same "say nothing, change nothing" rule @align already follows.
  -->
  <xsl:template name="valign-to-display-align">
    <xsl:param name="valign"/>
    <xsl:choose>
      <xsl:when test="$valign = 'top'">before</xsl:when>
      <xsl:when test="$valign = 'middle'">center</xsl:when>
      <xsl:when test="$valign = 'bottom'">after</xsl:when>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="entry">
    <fo:table-cell xsl:use-attribute-sets="body-cell">
      <!--
        Overrides the attribute-set's own text-align, and only when there
        actually is one to apply — an untouched table, with no align anywhere
        in its CALS markup, must render exactly as it always has.
      -->
      <xsl:variable name="align">
        <xsl:call-template name="entry-cell-attr"><xsl:with-param name="attr">align</xsl:with-param></xsl:call-template>
      </xsl:variable>
      <xsl:if test="normalize-space($align) != ''">
        <xsl:attribute name="text-align"><xsl:value-of select="$align"/></xsl:attribute>
      </xsl:if>
      <xsl:variable name="valign">
        <xsl:call-template name="entry-cell-attr"><xsl:with-param name="attr">valign</xsl:with-param></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="display-align">
        <xsl:call-template name="valign-to-display-align"><xsl:with-param name="valign" select="normalize-space($valign)"/></xsl:call-template>
      </xsl:variable>
      <xsl:if test="normalize-space($display-align) != ''">
        <xsl:attribute name="display-align"><xsl:value-of select="$display-align"/></xsl:attribute>
      </xsl:if>
      <!-- Bold: thead cells and first tbody row when no thead present -->
      <xsl:if test="parent::row/parent::thead or
                    (parent::row/parent::tbody and
                     not(parent::row/parent::tbody/parent::tgroup/thead) and
                     not(parent::row/preceding-sibling::row))">
        <xsl:attribute name="font-weight">bold</xsl:attribute>
      </xsl:if>
      <!-- Bottom border: always on thead rows; on tbody rows when rowsep="1" and not the last row -->
      <xsl:if test="parent::row/parent::thead or
                    (parent::row/following-sibling::row and
                     (ancestor::table/@rowsep='1' or ancestor::tgroup/@rowsep='1' or @rowsep='1'))">
        <xsl:attribute name="border-bottom-width">0.5pt</xsl:attribute>
        <xsl:attribute name="border-bottom-style">solid</xsl:attribute>
        <xsl:attribute name="border-bottom-color">black</xsl:attribute>
      </xsl:if>
      <!-- End (right) border: always when colsep="1" and there is a following sibling -->
      <xsl:if test="following-sibling::entry and
                    (ancestor::table/@colsep='1' or ancestor::tgroup/@colsep='1' or @colsep='1' or
                     not(ancestor::table/@colsep) and not(ancestor::tgroup/@colsep))">
        <xsl:attribute name="border-end-width">0.5pt</xsl:attribute>
        <xsl:attribute name="border-end-style">solid</xsl:attribute>
        <xsl:attribute name="border-end-color">black</xsl:attribute>
      </xsl:if>
      <xsl:if test="@namest and @nameend">
        <xsl:attribute name="number-columns-spanned">
          <xsl:call-template name="calculate-colspan">
            <xsl:with-param name="namest" select="@namest"/>
            <xsl:with-param name="nameend" select="@nameend"/>
          </xsl:call-template>
        </xsl:attribute>
      </xsl:if>
      <xsl:if test="@morerows">
        <xsl:attribute name="number-rows-spanned">
          <xsl:value-of select="@morerows + 1"/>
        </xsl:attribute>
      </xsl:if>
      <fo:block wrap-option="wrap">
        <xsl:apply-templates/>
      </fo:block>
    </fo:table-cell>
  </xsl:template>
  <!-- Calculate colspan from namest/nameend -->
  <xsl:template name="calculate-colspan">
    <xsl:param name="namest"/>
    <xsl:param name="nameend"/>
    <xsl:variable name="colspecs" select="ancestor::tgroup/colspec"/>
    <xsl:variable name="start-pos">
      <xsl:for-each select="$colspecs">
        <xsl:if test="@colname = $namest">
          <xsl:value-of select="position()"/>
        </xsl:if>
      </xsl:for-each>
    </xsl:variable>
    <xsl:variable name="end-pos">
      <xsl:for-each select="$colspecs">
        <xsl:if test="@colname = $nameend">
          <xsl:value-of select="position()"/>
        </xsl:if>
      </xsl:for-each>
    </xsl:variable>
    <xsl:value-of select="$end-pos - $start-pos + 1"/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    REFERENCES TABLE                                   -->
  <!-- ==================================================================== -->
  <xsl:template name="references">
    <fo:block id="references-section-{generate-id(ancestor::dmodule)}">
      <fo:block xsl:use-attribute-sets="centerhead2">References</fo:block>
      <fo:block padding-top="{$standard-leading}">
        <fo:block font-style="italic" text-align="center" space-after="6pt">
          Table 1  References
        </fo:block>
        <fo:table xsl:use-attribute-sets="table" start-indent="0pt" end-indent="0pt">
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-header font-weight="bold">
            <fo:table-row keep-with-next.within-column="always">
              <fo:table-cell xsl:use-attribute-sets="header-cell">
                <fo:block>Chap No./Document No.</fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell">
                <fo:block>Title</fo:block>
              </fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <xsl:choose>
              <xsl:when test="refs/dmRef or refs/pmRef">
                <xsl:apply-templates select="refs/dmRef | refs/pmRef" mode="refs"/>
              </xsl:when>
              <xsl:when test=".//dmRef or .//pmRef">
                <xsl:apply-templates select=".//dmRef | .//pmRef" mode="refs"/>
              </xsl:when>
              <xsl:otherwise>
                <fo:table-row>
                  <fo:table-cell xsl:use-attribute-sets="body-cell">
                    <fo:block>None</fo:block>
                  </fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell">
                    <fo:block> </fo:block>
                  </fo:table-cell>
                </fo:table-row>
              </xsl:otherwise>
            </xsl:choose>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </fo:block>
  </xsl:template>
  <xsl:template match="dmRef" mode="refs">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="."/>
        </fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:if test="dmRefAddressItems/dmTitle">
            <xsl:apply-templates select="dmRefAddressItems/dmTitle" mode="refs"/>
          </xsl:if>
        </fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>
  <xsl:template match="pmRef" mode="refs">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="."/>
        </fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="pmRefAddressItems/pmTitle"/>
        </fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>
  <xsl:template match="externalPubRef" mode="refs">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="externalPubRefIdent/externalPubCode"/>
        </fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="externalPubRefIdent/externalPubTitle"/>
        </fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>
  <xsl:template match="dmTitle" mode="refs">
    <xsl:apply-templates select="techName" mode="refs"/>
    <xsl:if test="infoName">
      <xsl:text> - </xsl:text>
      <xsl:apply-templates select="infoName" mode="refs"/>
    </xsl:if>
  </xsl:template>
  <xsl:template match="techName|infoName" mode="refs">
    <xsl:apply-templates/>
  </xsl:template>
</xsl:stylesheet>