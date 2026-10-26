<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     JSS to XSL-FO: Common block and inline templates
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <!-- ==================================================================== -->
    <!--                            MANUAL PAGE BREAK                          -->
    <!-- ==================================================================== -->
    <!--
      One exact, author-placed break, wherever it's needed — not tied to a
      heading level (see the per-level "Page break" heading setting for that
      coarser, always-on-this-level option instead). Authored as <?page-break?>
      in S1000D content (see s1000dtojss/content.xsl for why a PI, not an
      element, there) or directly as <pageBreak/> in a JSS-type project, since
      that format isn't schema-constrained. Either way it arrives here as
      <pageBreak/> in the jssbook, between two block-level siblings; an empty
      block carrying break-before pushes everything after it to a new page
      without inserting any visible content of its own.

      When the very next sibling is a section, this renders nothing: body.xsl
      picks up a pageBreak in that position and forces break-before onto that
      section's own heading instead (its "flat" rendering pulls every section
      out to render separately, in document order, so a pageBreak rendered
      here — as part of the PARENT's own content — would land near the top of
      the parent instead of where it was actually placed). Rendering it here
      too would add a second, misplaced break on top of the correct one.
    -->
    <xsl:template match="pageBreak[following-sibling::*[1][self::section]]"/>

    <xsl:template match="pageBreak">
        <fo:block break-before="page"/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                             PARAGRAPHS                                -->
    <!-- ==================================================================== -->
    <!--
      Flush left, no first-line indent — matching the stencil, where body
      paragraphs simply start at the section's body-indent with no further
      step-in. (indent="none" is kept as an explicit, now-redundant alias:
      no real content sets it, since flush is the default everywhere, but it
      stays valid rather than becoming a silently-ignored attribute.)
    -->
    <xsl:template match="para">
        <fo:block space-after="3mm" text-align="justify">
            <xsl:call-template name="xref-anchor"/>
            <xsl:apply-templates/>
        </fo:block>
    </xsl:template>

    <xsl:template match="para[@indent='none']">
        <fo:block space-after="3mm" text-align="justify">
            <xsl:call-template name="xref-anchor"/>
            <xsl:apply-templates/>
        </fo:block>
    </xsl:template>

    <xsl:template match="para[@align]">
        <fo:block space-after="3mm" text-align="{@align}">
            <xsl:call-template name="xref-anchor"/>
            <xsl:apply-templates/>
        </fo:block>
    </xsl:template>

    <!-- Emits id="..." on the current fo element when the JSS node carries an
         @id, so it can be an internalRef/dmRef target. Dedup handled by
         element-id. A no-op for the vast majority of nodes that have no @id. -->
    <xsl:template name="xref-anchor">
        <xsl:if test="@id">
            <xsl:attribute name="id"><xsl:call-template name="element-id"/></xsl:attribute>
        </xsl:if>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                          INLINE FORMATTING                            -->
    <!-- ==================================================================== -->
    <xsl:template match="b | bold">
        <fo:inline font-weight="bold"><xsl:apply-templates/></fo:inline>
    </xsl:template>

    <xsl:template match="i | italic">
        <fo:inline font-style="italic"><xsl:apply-templates/></fo:inline>
    </xsl:template>

    <xsl:template match="u | underline">
        <fo:inline text-decoration="underline"><xsl:apply-templates/></fo:inline>
    </xsl:template>

    <xsl:template match="sup | superscript">
        <fo:inline baseline-shift="super" font-size="70%"><xsl:apply-templates/></fo:inline>
    </xsl:template>

    <xsl:template match="sub | subscript">
        <fo:inline baseline-shift="sub" font-size="70%"><xsl:apply-templates/></fo:inline>
    </xsl:template>

    <xsl:template match="red">
        <fo:inline color="#CC0000"><xsl:apply-templates/></fo:inline>
    </xsl:template>

    <xsl:template match="br">
        <fo:block/>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                          CROSS REFERENCES                             -->
    <!-- ==================================================================== -->
    <!-- <xref> carries a reference produced by the S1000D stage. It renders as
         a clickable link; if the target can't be resolved it degrades to the
         plain label text, so nothing is ever lost or left dangling.
           <xref to="ID">   internal link  (only linked when ID exists in-book)
           <xref href="URL">external link  (opens in a PDF reader)             -->
    <xsl:variable name="link-color" select="'#2563EB'"/>

    <xsl:template match="xref[@href]">
        <fo:basic-link external-destination="url('{@href}')"
                       color="{$link-color}" text-decoration="underline">
            <xsl:apply-templates/>
        </fo:basic-link>
    </xsl:template>

    <xsl:template match="xref[@to]">
        <xsl:variable name="t" select="@to"/>
        <xsl:variable name="target" select="key('by-id', $t)[1]"/>
        <xsl:choose>
            <!-- Only linkify when the target id is actually present in the book,
                 so a reference to a module or element that isn't part of this
                 publication just reads as text instead of a dead link. -->
            <xsl:when test="$target">
                <fo:basic-link internal-destination="{$t}" color="{$link-color}">
                    <xsl:call-template name="xref-label">
                        <xsl:with-param name="target" select="$target"/>
                    </xsl:call-template>
                </fo:basic-link>
            </xsl:when>
            <xsl:otherwise>
                <xsl:call-template name="xref-label">
                    <xsl:with-param name="target" select="$target"/>
                </xsl:call-template>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="xref">
        <xsl:apply-templates/>
    </xsl:template>

    <!-- The visible text of a reference. If the author gave label text, use it.
         Otherwise name the target by what it is: "Figure 3-1", "Table 2-1", or
         a section's title — falling back to "see" when the target is unnamed or
         unresolved. -->
    <xsl:template name="xref-label">
        <xsl:param name="target"/>
        <xsl:choose>
            <xsl:when test="node()">
                <xsl:apply-templates/>
            </xsl:when>
            <xsl:when test="$target/self::figure">
                <xsl:text>Figure </xsl:text>
                <xsl:for-each select="$target"><xsl:call-template name="figure-number"/></xsl:for-each>
            </xsl:when>
            <xsl:when test="$target/self::table">
                <xsl:text>Table </xsl:text>
                <xsl:for-each select="$target"><xsl:call-template name="table-number"/></xsl:for-each>
            </xsl:when>
            <xsl:when test="$target/self::section and $target/title != ''">
                <xsl:value-of select="$target/title"/>
            </xsl:when>
            <!-- Unresolved dmRef: cite the raw DMC it carried (correct S1000D
                 practice for a reference outside this publication). -->
            <xsl:when test="@code != ''">
                <xsl:value-of select="@code"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:text>see</xsl:text>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                               LISTS                                   -->
    <!-- ==================================================================== -->
    <!--
      JSS lists label items (a), (b), (c) ... skipping i, o and v, then move to
      (i), (ii) for the next level down and finally plain bullets. The label
      column is fixed width so the item text aligns in a single column.
    -->
    <!--
      margin-left, not start-indent: start-indent is absolute from the
      reference area, so nesting a list inside an already-indented section
      would push its text off the right edge. margin-left is relative to the
      parent, so each level steps in by a fixed amount and nothing overflows.

      A TOP-LEVEL list (the common case: item lettering directly under a
      heading or paragraph) gets no extra step — it sits flush with whatever
      start-indent is already in force there, which is the same body-indent
      the heading's own title and paragraph text use, so "(a) ..." lines up
      with where the heading title starts, matching the stencil. Only a list
      NESTED inside another list steps in further, one 8mm increment per
      extra level, so nested lettering is still visibly indented from its
      parent item.
    -->
    <!-- fo:list-block requires at least one list-item, and fo:table at least
         one row, so empty ones are dropped rather than emitted as invalid FO. -->
    <xsl:template match="list[not(item)]"/>
    <xsl:template match="deflist[not(defitem)]"/>

    <xsl:template match="list">
        <!-- This list's own label-to-text gap, by label style. -->
        <xsl:variable name="level" select="count(ancestor-or-self::list)"/>
        <xsl:variable name="gap">
            <xsl:call-template name="list-gap">
                <xsl:with-param name="lvl" select="$level"/>
                <xsl:with-param name="type" select="@type"/>
            </xsl:call-template>
        </xsl:variable>
        <!-- A nested list sits inside its parent item's body, which already
             starts at the parent's TEXT column (label + gap). Margin 0 therefore
             lines a nested label up under the parent's text — the standard
             hanging nest: "(i)" sits under the start of "(a)"'s text, and "(b)"
             lines back up with "(a)". A top-level list (no ancestor list) has
             margin 0 too, so "(a)" aligns with the heading's own body text at
             whatever level that heading sits — the indent is inherited from the
             section, so it is managed per heading level automatically.
             list.indent adds an OPTIONAL extra step per level beyond this.

             The indents are expressed RELATIVE to whatever is inherited, not
             as absolute values. XSL-FO indents are measured from the reference
             area, so a plain margin-left="0mm"/end-indent="0mm" does not mean
             "flush with my parent" — it means "flush with the page column",
             and a list inside a bordered notice box therefore escaped the box
             and printed straight through its left and right rules. -->
        <fo:list-block space-after="3mm"
                       provisional-distance-between-starts="{concat($gap, 'mm')}"
                       provisional-label-separation="2mm"
                       start-indent="inherited-property-value(start-indent) + {concat(count(ancestor::list) * number($list.indent), 'mm')}"
                       end-indent="inherited-property-value(end-indent)"
                       text-indent="0mm">
            <xsl:apply-templates select="item"/>
        </fo:list-block>
    </xsl:template>

    <!-- The label-to-text gap (mm, unitless) for a list at nesting level $lvl
         with optional explicit @type. Style follows list-item-label's rule:
         explicit type, else depth (1 = alpha, 2 = roman, 3+ = bullet). -->
    <xsl:template name="list-gap">
        <xsl:param name="lvl"/>
        <xsl:param name="type"/>
        <xsl:choose>
            <xsl:when test="$type = 'roman'"><xsl:value-of select="$list.gap.roman"/></xsl:when>
            <xsl:when test="$type = 'bullet' or $type = 'dash'"><xsl:value-of select="$list.gap.bullet"/></xsl:when>
            <xsl:when test="$type"><xsl:value-of select="$list.gap.alpha"/></xsl:when>
            <xsl:when test="$lvl = 1"><xsl:value-of select="$list.gap.alpha"/></xsl:when>
            <xsl:when test="$lvl = 2"><xsl:value-of select="$list.gap.roman"/></xsl:when>
            <xsl:otherwise><xsl:value-of select="$list.gap.bullet"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template match="list/item">
        <fo:list-item space-after="{concat($list.item.space, 'mm')}">
            <fo:list-item-label end-indent="label-end()">
                <fo:block>
                    <xsl:call-template name="list-item-label"/>
                </fo:block>
            </fo:list-item-label>
            <fo:list-item-body start-indent="body-start()">
                <fo:block text-align="justify">
                    <xsl:apply-templates/>
                </fo:block>
            </fo:list-item-body>
        </fo:list-item>
    </xsl:template>

    <xsl:template name="list-item-label">
        <xsl:variable name="depth" select="count(ancestor::list)"/>
        <xsl:variable name="n" select="count(preceding-sibling::item) + 1"/>
        <xsl:variable name="style">
            <xsl:choose>
                <xsl:when test="parent::list/@type"><xsl:value-of select="parent::list/@type"/></xsl:when>
                <xsl:when test="$depth = 1">alpha</xsl:when>
                <xsl:when test="$depth = 2">roman</xsl:when>
                <xsl:otherwise>bullet</xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:choose>
            <xsl:when test="$style = 'alpha'">
                <xsl:text>(</xsl:text>
                <xsl:call-template name="jss-alpha">
                    <xsl:with-param name="n" select="$n"/>
                </xsl:call-template>
                <xsl:text>)</xsl:text>
            </xsl:when>
            <xsl:when test="$style = 'roman'">
                <xsl:text>(</xsl:text>
                <xsl:number value="$n" format="i"/>
                <xsl:text>)</xsl:text>
            </xsl:when>
            <xsl:when test="$style = 'number'">
                <xsl:value-of select="$n"/><xsl:text>.</xsl:text>
            </xsl:when>
            <xsl:otherwise>
                <!-- Bullet from the text font: the Symbol font has no middot -->
                <fo:inline>&#8226;</fo:inline>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!--
      Maps 1,2,3... onto a,b,c,...,h,j,k,... (i, o and v are skipped). Beyond
      the 23 available letters it wraps to aa, ab, ... so long lists still get
      unique labels instead of running off the end of the string.
    -->
    <xsl:template name="jss-alpha">
        <xsl:param name="n"/>
        <xsl:variable name="len" select="string-length($jss.alpha.lower)"/>
        <xsl:choose>
            <xsl:when test="$n &gt; $len">
                <xsl:call-template name="jss-alpha">
                    <xsl:with-param name="n" select="floor(($n - 1) div $len)"/>
                </xsl:call-template>
                <xsl:value-of select="substring($jss.alpha.lower, (($n - 1) mod $len) + 1, 1)"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:value-of select="substring($jss.alpha.lower, $n, 1)"/>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                        DEFINITION-STYLE ROWS                          -->
    <!-- ==================================================================== -->
    <!--
      Used by the Foreword ("E-mail Address : ...") and similar key/value blocks.

      Widths are absolute and sum to the table width. A percentage width would
      resolve against the region rather than the enclosing indented block, so a
      deflist inside a section would overrun the right margin.
    -->
    <xsl:template match="deflist">
        <fo:table table-layout="fixed" width="140mm" space-after="3mm">
            <fo:table-column column-width="45mm"/>
            <fo:table-column column-width="10mm"/>
            <fo:table-column column-width="85mm"/>
            <fo:table-body>
                <xsl:apply-templates select="defitem"/>
            </fo:table-body>
        </fo:table>
    </xsl:template>

    <xsl:template match="defitem">
        <fo:table-row>
            <fo:table-cell padding-bottom="2mm">
                <fo:block><xsl:apply-templates select="term"/></fo:block>
            </fo:table-cell>
            <fo:table-cell padding-bottom="2mm">
                <fo:block>:</fo:block>
            </fo:table-cell>
            <fo:table-cell padding-bottom="2mm">
                <xsl:apply-templates select="def"/>
            </fo:table-cell>
        </fo:table-row>
    </xsl:template>

    <xsl:template match="defitem/term">
        <xsl:apply-templates/>
    </xsl:template>

    <xsl:template match="defitem/def">
        <fo:block><xsl:apply-templates/></fo:block>
    </xsl:template>

    <xsl:template match="defitem/def/line">
        <fo:block><xsl:apply-templates/></fo:block>
    </xsl:template>

    <!-- Generic standalone line (no paragraph spacing) -->
    <xsl:template match="line">
        <fo:block><xsl:apply-templates/></fo:block>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                          SHARED BUILDING BLOCKS                       -->
    <!-- ==================================================================== -->
    <!-- Centered page title used by every front-matter page -->
    <xsl:template name="page-title">
        <xsl:param name="text"/>
        <fo:block text-align="center"
                  font-size="{$heading2-size}"
                  font-weight="bold"
                  space-after="6mm"
                  keep-with-next.within-page="always">
            <xsl:value-of select="$text"/>
        </fo:block>
    </xsl:template>

    <!-- Red-ruled box used for the notices on the cover and prelim pages -->
    <!--
      A bordered notice box, sized to the text column.

      margin-left/right="0" is load-bearing, not decoration. In XSL-FO a block's
      border and padding are painted OUTSIDE its content rectangle, and that
      rectangle already fills the whole column — so a bordered, padded box comes
      out wider than the text and visibly overhangs the header rule above it
      (measured: 173.56mm against a 167mm column). Naming any margin switches
      the processor to deriving the indents from margin + border + padding,
      which pulls the content in by exactly that much and puts the painted edge
      back on the column edge. Verified against FOP's own area tree.
    -->
    <xsl:template name="red-box">
        <xsl:param name="content"/>
        <xsl:param name="align">justify</xsl:param>
        <fo:block border="0.8pt solid #CC0000"
                  padding="3mm"
                  margin-left="0mm" margin-right="0mm"
                  color="#CC0000"
                  text-align="{$align}"
                  space-after="6mm">
            <xsl:copy-of select="$content"/>
        </fo:block>
    </xsl:template>

    <!-- Text nodes are copied verbatim; whitespace-only nodes are stripped by
         the strip-space declaration in the main stylesheet. -->
    <xsl:template match="text()">
        <xsl:value-of select="."/>
    </xsl:template>

</xsl:stylesheet>
